import { PageHeader } from '../common/PageHeader';
import React, { useState } from 'react';
import {
  RotateCcw,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  DollarSign,
  Building2,
  Calendar,
  Layers,
  CreditCard,
  Eye,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PurchaseReturn, PurchaseReturnReason, Product } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

export const PurchaseReturnsView: React.FC = () => {
  const {
    purchaseReturns,
    purchaseOrders,
    suppliers,
    products,
    createPurchaseReturn,
    accounts,
  } = useApp();
  const { can } = useAuth();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedReturn, setSelectedReturn] = useState<PurchaseReturn | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  // Form State for Creating Return
  const [supplierId, setSupplierId] = useState<string>('');
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('wh_shop');
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<PurchaseReturnReason>('damaged_in_transit');
  const [reasonDetails, setReasonDetails] = useState<string>('');
  const [settlementType, setSettlementType] = useState<'credit_note' | 'cash_refund' | 'bank_refund'>('credit_note');
  const [refundAccountId, setRefundAccountId] = useState<string>('acc_bank');

  // Return Line Items
  const [returnLines, setReturnLines] = useState<{
    product_id: string;
    quantity: number;
    unit_cost_bdt: number;
  }[]>([]);

  const [productSearch, setProductSearch] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Filtering
  const filteredReturns = purchaseReturns.filter(pr => {
    const matchesSearch =
      pr.return_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pr.purchase_order_number && pr.purchase_order_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      pr.items.some(i => i.product_name.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesReason = reasonFilter === 'all' || pr.reason === reasonFilter;
    const matchesSupplier = supplierFilter === 'all' || pr.supplier_id === supplierFilter;
    return matchesSearch && matchesReason && matchesSupplier;
  });

  // KPIs
  const totalReturnAmountBdt = purchaseReturns.reduce((s, pr) => s + pr.total_amount_bdt, 0);
  const totalItemsReturned = purchaseReturns.reduce((s, pr) => s + pr.items.reduce((iS, it) => iS + it.quantity, 0), 0);
  const creditNoteCount = purchaseReturns.filter(pr => pr.settlement_type === 'credit_note').length;

  const handleOpenCreate = () => {
    const firstSupp = suppliers[0];
    setSupplierId(firstSupp ? firstSupp.id : '');
    setPurchaseOrderId('');
    setWarehouseId('wh_shop');
    setReturnDate(new Date().toISOString().slice(0, 10));
    setReason('damaged_in_transit');
    setReasonDetails('');
    setSettlementType('credit_note');
    setRefundAccountId('acc_bank');
    setReturnLines([]);
    setProductSearch('');
    setErrorMsg('');
    setShowCreateModal(true);
  };

  const handleAddProductLine = (prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    if (returnLines.some(l => l.product_id === prodId)) {
      setReturnLines(returnLines.map(l => l.product_id === prodId ? { ...l, quantity: l.quantity + 1 } : l));
      return;
    }

    setReturnLines([
      ...returnLines,
      {
        product_id: prod.id,
        quantity: 1,
        unit_cost_bdt: prod.avg_cost || 2000,
      },
    ]);
  };

  const handleUpdateLineQty = (index: number, qty: number) => {
    const updated = [...returnLines];
    updated[index].quantity = Math.max(1, qty);
    setReturnLines(updated);
  };

  const handleUpdateLineCost = (index: number, cost: number) => {
    const updated = [...returnLines];
    updated[index].unit_cost_bdt = cost;
    setReturnLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    setReturnLines(returnLines.filter((_, i) => i !== index));
  };

  const totalCalculatedReturnBdt = returnLines.reduce((s, l) => s + (l.unit_cost_bdt * l.quantity), 0);

  const handleCreateReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setErrorMsg('Please select a supplier');
      return;
    }
    if (returnLines.length === 0) {
      setErrorMsg('Please add at least one item to return');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await createPurchaseReturn({
        supplier_id: supplierId,
        purchase_order_id: purchaseOrderId || undefined,
        warehouse_id: warehouseId,
        return_date: returnDate,
        reason,
        reason_details: reasonDetails,
        settlement_type: settlementType,
        refund_account_id: settlementType !== 'credit_note' ? refundAccountId : undefined,
        items: returnLines.map(l => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_cost_bdt: l.unit_cost_bdt,
        })),
      });
      setShowCreateModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process purchase return');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReasonBadge = (r: PurchaseReturnReason) => {
    switch (r) {
      case 'damaged_in_transit':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)]">Damaged in Transit</span>;
      case 'wrong_sku':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] text-[var(--status-amber)]">Wrong SKU Shipped</span>;
      case 'quality_defect':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_srgb,var(--accent-secondary)_10%,transparent)] text-[var(--accent-secondary)]">Defect / Leaking</span>;
      case 'expired_or_near_expiry':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-500/10 text-neutral-700">Near Expiry</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] text-[var(--status-teal)]">{r}</span>;
    }
  };

  return (
    <div className="space-y-6" id="purchase-returns-view-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)] flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-[var(--status-amber)]" />
            Purchase Returns to Suppliers
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Section 14: Process supplier returns for damaged atomizers, shipment variances, and quality defects with debit notes.
          </p>
        </div>

        {can('manage_purchases') && (
          <button
            id="btn-new-return"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--status-amber)] hover:opacity-90 text-white text-xs font-bold rounded-lg shadow-sm transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Purchase Return
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Return Value</p>
            <p className="text-2xl font-black text-[var(--status-red)] mt-1">&#2547;{totalReturnAmountBdt.toLocaleString()}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{purchaseReturns.length} Return Notes Logged</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)] flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Bottles Returned</p>
            <p className="text-2xl font-black text-[var(--status-amber)] mt-1">{totalItemsReturned.toLocaleString()}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Deducted from stock ledger</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] text-[var(--status-amber)] flex items-center justify-center font-bold">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Supplier Credit Notes</p>
            <p className="text-2xl font-black text-[var(--status-green)] mt-1">{creditNoteCount}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Payable balance adjustments</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)] flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search return #, supplier, or perfume..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All Reasons</option>
            <option value="damaged_in_transit">Damaged in Transit</option>
            <option value="wrong_sku">Wrong SKU Shipped</option>
            <option value="quality_defect">Quality / Leaking Defect</option>
            <option value="expired_or_near_expiry">Near Expiry</option>
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dense-table">
            <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Return Number & Date</th>
                <th className="py-3 px-4">Supplier & Warehouse</th>
                <th className="py-3 px-4">Reason & Details</th>
                <th className="py-3 px-4">Items Returned</th>
                <th className="py-3 px-4">Settlement Method</th>
                <th className="py-3 px-4 text-right">Return Amount</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                    No purchase returns recorded.
                  </td>
                </tr>
              ) : (
                filteredReturns.map(pr => (
                  <tr key={pr.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[var(--text)]">{pr.return_number}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[var(--accent)]" />
                        <span>{pr.return_date}</span>
                      </div>
                      {pr.purchase_order_number && (
                        <div className="text-[10px] text-[var(--status-teal)] font-medium mt-0.5">
                          Ref: {pr.purchase_order_number}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-[var(--text)]">{pr.supplier_name}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{pr.warehouse_name}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div>{getReasonBadge(pr.reason)}</div>
                      {pr.reason_details && (
                        <div className="text-[11px] text-[var(--text-muted)] mt-1 max-w-xs truncate" title={pr.reason_details}>
                          {pr.reason_details}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-[var(--text)]">
                        {pr.items.reduce((s, i) => s + i.quantity, 0)} bottles
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">{pr.items.length} line items</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]">
                        {pr.settlement_type === 'credit_note' ? 'Credit Note (Payable -)' : pr.settlement_type.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="font-black text-sm text-[var(--status-red)]">&#2547;{pr.total_amount_bdt.toLocaleString()}</div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedReturn(pr);
                          setShowDetailModal(true);
                        }}
                        className="p-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--accent)] hover:text-white rounded transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL: Create Purchase Return --- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-[var(--status-amber)]" />
                <h3 className="text-sm font-bold text-[var(--text)]">Record Purchase Return to Supplier</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReturnSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Supplier *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-semibold"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.country})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Origin Warehouse (Deduct From)</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="wh_shop">Shop Floor (Showroom)</option>
                    <option value="wh_main">Main / Back-store (2nd Floor)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Return Date</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Primary Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as PurchaseReturnReason)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-semibold text-[var(--status-red)]"
                  >
                    <option value="damaged_in_transit">Damaged in Transit / Crushed Atomizer</option>
                    <option value="wrong_sku">Wrong SKU Shipped</option>
                    <option value="quality_defect">Quality / Leaking / Batch Defect</option>
                    <option value="expired_or_near_expiry">Near Expiry / Stale Batch</option>
                    <option value="overshipment">Overshipment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Settlement Method</label>
                  <select
                    value={settlementType}
                    onChange={(e) => setSettlementType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-bold text-[var(--status-green)]"
                  >
                    <option value="credit_note">Credit Note (Reduces Supplier Payable)</option>
                    <option value="bank_refund">Bank Wire Refund</option>
                    <option value="cash_refund">Cash Refund</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Related Purchase Order (Optional)</label>
                  <select
                    value={purchaseOrderId}
                    onChange={(e) => setPurchaseOrderId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">-- None / General Stock Return --</option>
                    {purchaseOrders
                      .filter(po => !supplierId || po.supplier_id === supplierId)
                      .map(po => (
                        <option key={po.id} value={po.id}>{po.po_number} ({po.order_date})</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Perfumes to Return</h4>
                  <div className="w-72 relative">
                    <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search to add perfumes to return..."
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
                      .slice(0, 6)
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
                          <button type="button" className="px-2 py-0.5 bg-[var(--status-amber)] text-white text-[10px] font-bold rounded">
                            + Select
                          </button>
                        </div>
                      ))}
                  </div>
                )}

                <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                  <table className="dense-table">
                    <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Perfume</th>
                        <th className="py-2.5 px-3 text-center">Return Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Cost (&#2547;)</th>
                        <th className="py-2.5 px-3 text-right">Total Debit (&#2547;)</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {returnLines.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-[var(--text-muted)]">
                            No items added. Search above to add items to return to supplier.
                          </td>
                        </tr>
                      ) : (
                        returnLines.map((line, idx) => {
                          const prod = products.find(p => p.id === line.product_id);
                          const lineTotal = line.unit_cost_bdt * line.quantity;

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
                                  className="w-16 px-2 py-1 text-xs text-center bg-[var(--surface-sunken)] border border-[var(--border)] rounded font-bold text-[var(--status-red)]"
                                />
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  value={line.unit_cost_bdt}
                                  onChange={(e) => handleUpdateLineCost(idx, parseFloat(e.target.value) || 0)}
                                  className="w-24 px-2 py-1 text-xs text-right bg-[var(--surface-sunken)] border border-[var(--border)] rounded font-bold text-[var(--text)]"
                                />
                              </td>

                              <td className="py-2.5 px-3 text-right font-black text-[var(--status-red)]">
                                &#2547;{lineTotal.toLocaleString()}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(idx)}
                                  className="p-1 text-[var(--status-red)] hover:text-[var(--status-red)]"
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

              <div>
                <label className="block text-xs font-bold text-[var(--text)] mb-1">Defect Inspection & Photographic Notes</label>
                <textarea
                  rows={2}
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  placeholder="e.g. 2 bottles leaking around crimped collar during transit unboxing; photos sent to supplier via WhatsApp."
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="p-3 bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-amber)_20%,transparent)] rounded-xl flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">
                  Total Debit / Refund Value:
                </span>
                <span className="text-base font-black text-[var(--status-red)]">
                  &#2547;{totalCalculatedReturnBdt.toLocaleString()}
                </span>
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
                  disabled={isSubmitting || returnLines.length === 0}
                  className="px-5 py-2 bg-[var(--status-amber)] text-white text-xs font-bold rounded-lg hover:opacity-90 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Return & Post Journal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Detail View --- */}
      {showDetailModal && selectedReturn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-[var(--status-amber)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Purchase Return: {selectedReturn.return_number}</h3>
                  <p className="text-xs text-[var(--text-muted)]">Processed: {selectedReturn.return_date}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] text-xs">
                <div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Supplier</p>
                  <p className="font-bold text-[var(--text)] mt-0.5">{selectedReturn.supplier_name}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Warehouse</p>
                  <p className="font-bold text-[var(--text)] mt-0.5">{selectedReturn.warehouse_name}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Reason</p>
                  <div className="mt-0.5">{getReasonBadge(selectedReturn.reason)}</div>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Settlement</p>
                  <p className="font-bold text-[var(--status-green)] mt-0.5">{selectedReturn.settlement_type.replace('_', ' ')}</p>
                </div>
              </div>

              {selectedReturn.reason_details && (
                <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] text-xs">
                  <p className="font-bold text-[var(--text)] mb-0.5">Details / Notes:</p>
                  <p className="text-[var(--text-muted)]">{selectedReturn.reason_details}</p>
                </div>
              )}

              <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="dense-table">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-center">Returned Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost (&#2547;)</th>
                      <th className="py-2.5 px-3 text-right">Total Debit (&#2547;)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {selectedReturn.items.map(it => (
                      <tr key={it.id} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[var(--text)]">{it.product_name}</div>
                          <div className="text-[11px] text-[var(--text-muted)] font-mono">{it.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-[var(--status-red)]">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-[var(--text)]">&#2547;{it.unit_cost_bdt.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-black text-[var(--status-red)]">&#2547;{it.total_amount_bdt.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Total Debit Value:</span>
                <span className="text-xl font-black text-[var(--status-red)]">&#2547;{selectedReturn.total_amount_bdt.toLocaleString()}</span>
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
