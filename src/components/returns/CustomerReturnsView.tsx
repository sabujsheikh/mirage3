import { PageHeader } from '../common/PageHeader';
import React, { useState } from 'react';
import {
  RotateCcw,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Package,
  Barcode,
  Sparkles,
  Flame,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Plus,
  Eye,
  X,
  MapPin,
  DollarSign,
  AlertCircle,
  Truck,
  FileText,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  CustomerReturn,
  CustomerReturnType,
  CustomerReturnReason,
  ItemReturnCondition,
  Order,
} from '../../types';

export const CustomerReturnsView: React.FC = () => {
  const {
    customerReturns,
    returnsSummary,
    orders,
    courierBookings,
    products,
    warehouses,
    accounts,
    processCustomerReturn,
    updateReturnCourierFeeManual,
    refreshAll,
  } = useApp();
  const { currentUser, can } = useAuth();

  const [activeTab, setActiveTab] = useState<'all' | 'rto' | 'damaged'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');

  // Intake Modal State
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [scannedInvoiceOrBarcode, setScannedInvoiceOrBarcode] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [returnType, setReturnType] = useState<CustomerReturnType>('courier_rto');
  const [returnReason, setReturnReason] = useState<CustomerReturnReason>('refused_at_doorstep');
  const [reasonDetails, setReasonDetails] = useState('');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [courierFeeLoss, setCourierFeeLoss] = useState<number>(60);
  const [refundMethod, setRefundMethod] = useState<'bkash' | 'nagad' | 'bank_transfer' | 'cash' | 'store_credit' | 'none_rto'>('none_rto');
  const [refundAccountId, setRefundAccountId] = useState<string>('acc_bkash');
  const [returnNotes, setReturnNotes] = useState('');

  // RTO Courier Fee Manual Adjustment State in Detail Modal
  const [isEditingRtoFee, setIsEditingRtoFee] = useState(false);
  const [newRtoFeeValue, setNewRtoFeeValue] = useState<number>(0);
  const [rtoFeeNotes, setRtoFeeNotes] = useState('');
  const [isUpdatingRtoFee, setIsUpdatingRtoFee] = useState(false);

  // Item lines state for intake
  const [returnLines, setReturnLines] = useState<
    {
      product_id: string;
      product_name: string;
      sku: string;
      max_qty: number;
      quantity: number;
      condition: ItemReturnCondition;
      restock_warehouse_id: string;
      unit_price: number;
      unit_cost: number;
    }[]
  >([]);

  const [selectedReturn, setSelectedReturn] = useState<CustomerReturn | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filter returns
  const filteredReturns = customerReturns.filter((r) => {
    const matchesSearch =
      r.return_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer_phone.includes(searchTerm);

    const matchesType =
      typeFilter === 'all'
        ? activeTab === 'rto'
          ? r.return_type === 'courier_rto'
          : true
        : r.return_type === typeFilter;

    const matchesCondition =
      conditionFilter === 'all'
        ? true
        : r.items.some((it) => it.condition === conditionFilter);

    return matchesSearch && matchesType && matchesCondition;
  });

  // Calculate metrics
  const totalReturnsCount = customerReturns.length;
  const totalRtoCount = customerReturns.filter((r) => r.return_type === 'courier_rto').length;
  const totalRefunded = customerReturns.reduce((sum, r) => sum + (r.refund_amount || 0), 0);
  const totalCourierLoss = customerReturns.reduce((sum, r) => sum + (r.courier_fee_loss || 0), 0);

  let restockedBottles = 0;
  let testerBottles = 0;
  let damagedBottles = 0;

  customerReturns.forEach((r) => {
    r.items.forEach((it) => {
      if (it.condition === 'restockable') restockedBottles += it.quantity;
      else if (it.condition === 'damaged_tester') testerBottles += it.quantity;
      else if (it.condition === 'damaged_writeoff') damagedBottles += it.quantity;
    });
  });

  // Handle barcode/invoice gun search in modal
  const handleFindOrder = (query: string) => {
    setScannedInvoiceOrBarcode(query);
    const cleaned = query.trim().toUpperCase();
    if (!cleaned) return;

    const found = orders.find(
      (o) =>
        o.invoice_number.toUpperCase() === cleaned ||
        o.order_barcode === cleaned ||
        o.courier_tracking_code?.toUpperCase() === cleaned ||
        o.id === cleaned
    );

    if (found) {
      setSelectedOrder(found);
      setErrorMsg('');

      setReturnLines(
        found.items.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku,
          max_qty: it.quantity,
          quantity: it.quantity,
          condition: 'restockable' as ItemReturnCondition,
          restock_warehouse_id: 'wh_shop',
          unit_price: it.unit_price,
          unit_cost: it.unit_cost_at_sale || 2200,
        }))
      );

      const linkedBooking = courierBookings.find((b) => b.order_id === found.id);
      if (found.status === 'dispatched' || found.status === 'packed' || found.status === 'rto') {
        setReturnType('courier_rto');
        setReturnReason('refused_at_doorstep');
        setRefundMethod('none_rto');
        setRefundAmount(0);
        // Distinguish confirmed actual charge vs booking estimate
        const initialFee = linkedBooking?.actual_charge ?? linkedBooking?.estimated_charge ?? 60;
        setCourierFeeLoss(initialFee);
      } else {
        setReturnType('customer_return');
        setReturnReason('damaged_bottle');
        setRefundMethod('bkash');
        setRefundAmount(found.total);
        setCourierFeeLoss(0);
      }
    }
  };

  const handleOpenIntake = (order?: Order) => {
    setErrorMsg('');
    if (order) {
      setSelectedOrder(order);
      setScannedInvoiceOrBarcode(order.invoice_number);
      handleFindOrder(order.invoice_number);
    } else {
      setSelectedOrder(null);
      setScannedInvoiceOrBarcode('');
      setReturnLines([]);
      setReturnType('courier_rto');
      setReturnReason('refused_at_doorstep');
      setRefundAmount(0);
      setCourierFeeLoss(60);
      setRefundMethod('none_rto');
      setReasonDetails('');
      setReturnNotes('');
    }
    setShowIntakeModal(true);
  };

  const handleLineConditionChange = (idx: number, condition: ItemReturnCondition) => {
    const updated = [...returnLines];
    updated[idx].condition = condition;
    setReturnLines(updated);
  };

  const handleLineWarehouseChange = (idx: number, warehouseId: string) => {
    const updated = [...returnLines];
    updated[idx].restock_warehouse_id = warehouseId;
    setReturnLines(updated);
  };

  const handleLineQtyChange = (idx: number, qty: number) => {
    const updated = [...returnLines];
    updated[idx].quantity = Math.max(0, Math.min(updated[idx].max_qty, qty));
    setReturnLines(updated);
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) {
      setErrorMsg('Please select or scan an order to process return.');
      return;
    }

    const activeLines = returnLines.filter((l) => l.quantity > 0);
    if (activeLines.length === 0) {
      setErrorMsg('At least one item must have a returned quantity > 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await processCustomerReturn({
        order_id: selectedOrder.id,
        return_type: returnType,
        reason: returnReason,
        reason_details: reasonDetails,
        items: activeLines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          condition: l.condition,
          restock_warehouse_id: l.restock_warehouse_id,
        })),
        refund_amount: Number(refundAmount),
        courier_fee_loss: Number(courierFeeLoss),
        refund_method: refundMethod,
        refund_account_id: refundAccountId,
        notes: returnNotes,
      });

      setShowIntakeModal(false);
      setSelectedOrder(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process customer return');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetail = (ret: CustomerReturn) => {
    setSelectedReturn(ret);
    setNewRtoFeeValue(ret.courier_fee_loss || 0);
    setIsEditingRtoFee(false);
    setRtoFeeNotes('');
    setShowDetailModal(true);
  };

  const handleUpdateRtoFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn) return;
    setIsUpdatingRtoFee(true);
    try {
      await updateReturnCourierFeeManual(selectedReturn.id, newRtoFeeValue, rtoFeeNotes);
      setSelectedReturn({
        ...selectedReturn,
        courier_fee_loss: newRtoFeeValue,
        courier_fee_source: 'manual',
      });
      setIsEditingRtoFee(false);
      setRtoFeeNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to update return courier fee');
    } finally {
      setIsUpdatingRtoFee(false);
    }
  };

  const reasonLabels: Record<CustomerReturnReason, string> = {
    refused_at_doorstep: 'Refused at Doorstep (Customer Unreachable / Changed Mind)',
    wrong_address: 'Incorrect Address / Zone Out of Range',
    damaged_bottle: 'Damaged Bottle / Leaking Atomizer',
    wrong_item_sent: 'Wrong Perfume / SKU Shipped',
    customer_remorse: 'Customer Remorse (Unopened Change of Mind)',
    fragrance_dislike: 'Customer Disliked Scent Profile',
    other: 'Other Issue',
  };

  return (
    <div className="space-y-6" id="returns-management-view">
      {/* Page Header */}
      <PageHeader
        eyebrow="Orders / Returns"
        title="Returns & RTO Tracking"
        desc="Courier return-to-origin scanning, customer refunds, damaged stock loss, and restocking"
        actions={
          <button
            onClick={() => setShowIntakeModal(true)}
            className="erp-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Process Return / RTO</span>
          </button>
        }
      />

      {/* KPI Cards: Returns, RTO, and Condition Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Returns */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Total Return Intakes</span>
            <RotateCcw className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text)]">{totalReturnsCount}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Courier RTOs: <span className="font-semibold text-[var(--status-red)]">{totalRtoCount}</span> &#8226; Delivered Returns: <span className="font-semibold text-[var(--status-teal)]">{totalReturnsCount - totalRtoCount}</span>
          </div>
        </div>

        {/* Restocked to Available Inventory */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Restocked to Shelves</span>
            <Package className="w-4 h-4 text-[var(--status-green)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-green)]">{restockedBottles} bottles</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Restored to available on-hand stock
          </div>
        </div>

        {/* Converted to Showroom Testers */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Showroom Tester Routed</span>
            <Sparkles className="w-4 h-4 text-[var(--status-amber)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-amber)]">{testerBottles} bottles</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Unsealed / minor blemish marketing stock
          </div>
        </div>

        {/* Damaged / Broken Write-offs */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Damaged Write-Off Loss</span>
            <Flame className="w-4 h-4 text-[var(--status-red)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-red)]">{damagedBottles} bottles</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Broken glass / leaking write-offs
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'all'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <FileText className="w-4 h-4" />
          All Returns & Intake Ledgers ({customerReturns.length})
        </button>

        <button
          onClick={() => setActiveTab('rto')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'rto'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Truck className="w-4 h-4" />
          Courier RTOs ({totalRtoCount})
        </button>

        <button
          onClick={() => setActiveTab('damaged')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'damaged'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Tester & Damaged Stock Archive ({testerBottles + damagedBottles} bottles)
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search return #, invoice, customer phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:outline-hidden"
          >
            <option value="all">All Return Types</option>
            <option value="courier_rto">Courier RTO</option>
            <option value="customer_return">Customer Return</option>
          </select>

          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:outline-hidden"
          >
            <option value="all">All Triage Conditions</option>
            <option value="restockable">Restockable to Shelf</option>
            <option value="damaged_tester">Showroom Tester</option>
            <option value="damaged_writeoff">Damaged Loss Writeoff</option>
          </select>
        </div>
      </div>

      {/* Returns Table */}
      <div className="dense-table-container">
        <div className="overflow-x-auto">
          <table className="dense-table">
            <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Return # & Date</th>
                <th className="py-3 px-4">Order / Invoice</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Type & Reason</th>
                <th className="py-3 px-4 text-center">Items Triaged</th>
                <th className="py-3 px-4 text-right">Refund / Loss</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-[var(--text-muted)]">
                    No returns found matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => {
                  const isRto = ret.return_type === 'courier_rto';

                  return (
                    <tr key={ret.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--text)] font-mono">{ret.return_number}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {new Date(ret.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-[var(--accent)] font-mono">{ret.invoice_number}</span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-[var(--text)]">{ret.customer_name}</div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono">{ret.customer_phone}</div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isRto
                                ? 'bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)]'
                                : 'bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] text-[var(--status-teal)]'
                            }`}
                          >
                            {isRto ? 'Courier RTO' : 'Customer Return'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate" title={reasonLabels[ret.reason] || ret.reason}>
                          {reasonLabels[ret.reason] || ret.reason}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="font-bold text-[var(--text)]">{ret.total_items_count} bottles</div>
                        <div className="flex items-center justify-center gap-1 text-[10px] text-[var(--text-muted)] mt-0.5">
                          {ret.items.map((it, idx) => (
                            <span
                              key={idx}
                              className={`px-1 py-0.2 rounded font-mono ${
                                it.condition === 'restockable'
                                  ? 'bg-[color-mix(in_srgb,var(--status-green)_15%,transparent)] text-[var(--status-green)] bg-[color-mix(in_srgb,var(--status-green)_12%,transparent)] text-[var(--status-green)]'
                                  : it.condition === 'damaged_tester'
                                  ? 'bg-[color-mix(in_srgb,var(--status-amber)_16%,transparent)] text-[var(--status-amber)] bg-[color-mix(in_srgb,var(--status-amber)_12%,transparent)] text-[var(--status-amber)]'
                                  : 'bg-[color-mix(in_srgb,var(--status-red)_15%,transparent)] text-[var(--status-red)] bg-[color-mix(in_srgb,var(--status-red)_12%,transparent)] text-[var(--status-red)]'
                              }`}
                              title={`${it.product_name} (${it.condition})`}
                            >
                              {it.quantity} {it.condition === 'restockable' ? 'Restocked' : it.condition === 'damaged_tester' ? 'Tester' : 'Scrap'}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono">
                        {ret.refund_amount > 0 && (
                          <div className="font-bold text-[var(--status-red)]">
                            Refund: &#2547;{ret.refund_amount.toLocaleString()}
                          </div>
                        )}
                        {ret.courier_fee_loss > 0 && (
                          <div className="text-[11px] text-[var(--status-amber)]">
                            Carrier Fee: &#2547;{ret.courier_fee_loss.toLocaleString()}
                          </div>
                        )}
                        {ret.refund_amount === 0 && ret.courier_fee_loss === 0 && (
                          <div className="text-[11px] text-[var(--text-muted)]">&#8212;</div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            ret.status === 'closed'
                              ? 'bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]'
                              : 'bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] text-[var(--status-teal)]'
                          }`}
                        >
                          {ret.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenDetail(ret)}
                          className="p-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--accent)] hover:text-white rounded transition-colors cursor-pointer"
                          title="View Return Slip & Journal Postings"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

      {/* --- MODAL: Process Return / Physical Scan-Back Intake --- */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Physical Return Intake & Inspection Station</h3>
                  <p className="text-xs text-[var(--text-muted)]">Scan barcode or enter invoice number to load parcel contents</p>
                </div>
              </div>
              <button onClick={() => setShowIntakeModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto text-xs">
              {errorMsg && (
                <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Barcode & Invoice Gun Search */}
              <div className="p-4 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-3">
                <label className="block font-bold text-[var(--text)]">
                  Scan Printed Return Barcode or Type Invoice # (e.g. INV-2026-1001, STF-882910)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Scan with barcode gun or type invoice #..."
                      value={scannedInvoiceOrBarcode}
                      onChange={(e) => handleFindOrder(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono font-bold focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>

                {selectedOrder && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)] text-[11px]">
                    <div>
                      <span className="text-[var(--text-muted)]">Customer:</span>
                      <p className="font-bold text-[var(--text)]">{selectedOrder.customer_name}</p>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Phone:</span>
                      <p className="font-mono text-[var(--text)]">{selectedOrder.customer_phone}</p>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Order Status:</span>
                      <p className="font-bold uppercase text-[var(--accent)]">{selectedOrder.status}</p>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Original Total:</span>
                      <p className="font-black text-[var(--text)]">&#2547;{selectedOrder.total.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedOrder && (
                <>
                  {/* Return Category & Reason */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-[var(--text)] mb-1">Return Workflow Type *</label>
                      <select
                        value={returnType}
                        onChange={(e) => {
                          const val = e.target.value as CustomerReturnType;
                          setReturnType(val);
                          if (val === 'courier_rto') {
                            setRefundMethod('none_rto');
                            setRefundAmount(0);
                            setCourierFeeLoss(60);
                          } else {
                            setRefundMethod('bkash');
                            setRefundAmount(selectedOrder.total);
                            setCourierFeeLoss(0);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-bold"
                      >
                        <option value="courier_rto">Courier RTO (Undelivered / Returned from Steadfast Hub)</option>
                        <option value="customer_return">Delivered Customer Return (Refund / Replacement)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-[var(--text)] mb-1">Return Reason *</label>
                      <select
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value as CustomerReturnReason)}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                      >
                        {Object.entries(reasonLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-[var(--text)] mb-1">Inspection & Defect Details</label>
                      <input
                        type="text"
                        value={reasonDetails}
                        onChange={(e) => setReasonDetails(e.target.value)}
                        placeholder="e.g. Cap loose, carton slightly crushed, seal verified intact..."
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                      />
                    </div>
                  </div>

                  {/* Section 35.2 Line Item Physical Condition Triage */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-[var(--text)] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-[var(--accent)]" />
                      Physical Bottle Inspection & Condition Triage (Section 35.2)
                    </h4>

                    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Perfume Bottle</th>
                            <th className="py-2.5 px-3 text-center">Qty Returned</th>
                            <th className="py-2.5 px-3">Physical Condition Triage</th>
                            <th className="py-2.5 px-3">Restock Location</th>
                            <th className="py-2.5 px-3 text-right">Landed Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {returnLines.map((line, idx) => (
                            <tr key={line.product_id} className="hover:bg-[var(--surface-hover)]">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-[var(--text)]">{line.product_name}</div>
                                <div className="text-[10px] text-[var(--text-muted)] font-mono">{line.sku}</div>
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={line.max_qty}
                                  value={line.quantity}
                                  onChange={(e) => handleLineQtyChange(idx, parseInt(e.target.value) || 0)}
                                  className="w-16 px-2 py-1 text-center rounded border border-[var(--border)] bg-[var(--surface)] font-bold text-[var(--text)]"
                                />
                                <span className="text-[10px] text-[var(--text-muted)] block">/ {line.max_qty}</span>
                              </td>

                              <td className="py-2.5 px-3">
                                <select
                                  value={line.condition}
                                  onChange={(e) =>
                                    handleLineConditionChange(idx, e.target.value as ItemReturnCondition)
                                  }
                                  className={`px-2 py-1 rounded font-semibold border ${
                                    line.condition === 'restockable'
                                      ? 'bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border-[color-mix(in_srgb,var(--status-green)_30%,transparent)] text-[var(--status-green)]'
                                      : line.condition === 'damaged_tester'
                                      ? 'bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] border-[color-mix(in_srgb,var(--status-amber)_30%,transparent)] text-[var(--status-amber)]'
                                      : 'bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] text-[var(--status-red)]'
                                  }`}
                                >
                                  <option value="restockable">&#9989; Restockable (Sealed & Untampered)</option>
                                  <option value="damaged_tester">&#10024; Showroom Tester (Unsealed / Minor Blemish)</option>
                                  <option value="damaged_writeoff">&#128293; Damaged Loss Write-off (Broken Glass / Leak)</option>
                                </select>
                              </td>

                              <td className="py-2.5 px-3">
                                <select
                                  disabled={line.condition !== 'restockable'}
                                  value={line.restock_warehouse_id}
                                  onChange={(e) => handleLineWarehouseChange(idx, e.target.value)}
                                  className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] disabled:opacity-50"
                                >
                                  <option value="wh_shop">Shop Floor (Showroom)</option>
                                  <option value="wh_main">Main Back-store (2nd Floor)</option>
                                </select>
                              </td>

                              <td className="py-2.5 px-3 text-right font-mono text-[var(--text-muted)]">
                                &#2547;{line.unit_cost.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Financial Settlement & Journal Preview */}
                  <div className="p-4 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-3">
                    <h4 className="font-bold text-[var(--text)] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-[var(--accent)]" />
                      Financial Settlement & Accounting Posting (Section 15.3)
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {returnType === 'customer_return' ? (
                        <>
                          <div>
                            <label className="block font-bold text-[var(--text)] mb-1">Customer Refund Amount (&#2547;)</label>
                            <input
                              type="number"
                              value={refundAmount}
                              onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-bold text-[var(--status-red)]"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-[var(--text)] mb-1">Refund Method</label>
                            <select
                              value={refundMethod}
                              onChange={(e) => setRefundMethod(e.target.value as any)}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                            >
                              <option value="bkash">bKash Merchant Payout</option>
                              <option value="nagad">Nagad Merchant Payout</option>
                              <option value="bank_transfer">City Bank Electronic Transfer</option>
                              <option value="cash">Cash Till Refund</option>
                              <option value="store_credit">Store Credit / Customer Balance</option>
                            </select>
                          </div>

                          <div>
                            <label className="block font-bold text-[var(--text)] mb-1">Disburse From Account</label>
                            <select
                              value={refundAccountId}
                              onChange={(e) => setRefundAccountId(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                            >
                              {accounts
                                .filter((a) => a.type === 'asset')
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name} (&#2547;{a.balance.toLocaleString()})
                                  </option>
                                ))}
                            </select>
                          </div>
                        </>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block font-bold text-[var(--text)]">Steadfast RTO Return Freight / Fee (&#2547;)</label>
                            {selectedOrder && (
                              <span className="text-[10px]">
                                {courierBookings.find((b) => b.order_id === selectedOrder.id)?.actual_charge != null ? (
                                  <span className="text-[var(--status-green)] font-semibold">Confirmed Actual Charge</span>
                                ) : (
                                  <span className="text-amber-700 dark:text-amber-400 font-semibold">Estimate (Actual Pending)</span>
                                )}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={courierFeeLoss}
                            onChange={(e) => setCourierFeeLoss(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-bold text-[var(--status-amber)]"
                            min="0"
                          />
                          <p className="text-[10px] text-[var(--text-muted)] mt-1">
                            Steadfast deducts return freight fee from COD clearing ledger. You can manually enter or override the exact carrier charge from Steadfast paper invoice or portal.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)] text-[11px] space-y-1">
                      <p className="font-bold text-[var(--text)]">Automated Double-Entry Ledger Postings:</p>
                      <ul className="list-disc list-inside text-[var(--text-muted)] space-y-0.5">
                        {returnLines.some((l) => l.condition === 'restockable' && l.quantity > 0) && (
                          <li>
                            <strong>Dr Perfume Stock Inventory</strong>, <strong>Cr COGS</strong> (Restores product asset on shelf)
                          </li>
                        )}
                        {returnLines.some((l) => l.condition === 'damaged_tester' && l.quantity > 0) && (
                          <li>
                            <strong>Dr Showroom Tester Expense</strong>, <strong>Cr COGS</strong> (Reallocates to showroom marketing)
                          </li>
                        )}
                        {returnLines.some((l) => l.condition === 'damaged_writeoff' && l.quantity > 0) && (
                          <li>
                            <strong>Dr Damaged & Broken Loss</strong>, <strong>Cr COGS</strong> (Writes off damaged bottle expense)
                          </li>
                        )}
                        {returnType === 'customer_return' && refundAmount > 0 && (
                          <li>
                            <strong>Dr Sales Returns & Customer Refunds</strong>, <strong>Cr Cash / Bank / MFS</strong> (Disburses cash refund)
                          </li>
                        )}
                        {returnType === 'courier_rto' && courierFeeLoss > 0 && (
                          <li>
                            <strong>Dr Courier Freight & RTO Charges</strong>, <strong>Cr Courier Receivable</strong> (Recognizes carrier fee)
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedOrder}
                  className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing Intake...' : 'Confirm Return & Post Journals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Return Slip & Inspection Detail Viewer --- */}
      {showDetailModal && selectedReturn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Return Slip: {selectedReturn.return_number}</h3>
                  <p className="text-xs text-[var(--text-muted)]">Order: {selectedReturn.invoice_number}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
                <div>
                  <p className="text-[10px] text-[var(--text-muted)]">Customer</p>
                  <p className="font-bold text-[var(--text)] mt-0.5">{selectedReturn.customer_name}</p>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono">{selectedReturn.customer_phone}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)]">Return Type</p>
                  <p className="font-bold uppercase text-[var(--accent)] mt-0.5">{selectedReturn.return_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)]">Reason</p>
                  <p className="font-semibold text-[var(--text)] mt-0.5">{reasonLabels[selectedReturn.reason] || selectedReturn.reason}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)]">Inspected By</p>
                  <p className="font-bold text-[var(--text)] mt-0.5">{selectedReturn.inspected_by_name}</p>
                </div>
              </div>

              <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Perfume Bottle</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3">Condition Triage</th>
                      <th className="py-2.5 px-3">Restock Location</th>
                      <th className="py-2.5 px-3 text-right">Landed Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {selectedReturn.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[var(--text)]">{it.product_name}</div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">{it.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">{it.quantity}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              it.condition === 'restockable'
                                ? 'bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]'
                                : it.condition === 'damaged_tester'
                                ? 'bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] text-[var(--status-amber)]'
                                : 'bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)]'
                            }`}
                          >
                            {it.condition.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-muted)]">{it.restock_warehouse_name}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          &#2547;{(it.quantity * it.unit_cost).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedReturn.refund_amount > 0 && (
                <div className="p-4 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Disbursed Refund</span>
                    <p className="text-base font-black text-[var(--status-red)]">&#2547;{selectedReturn.refund_amount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Payment Channel</span>
                    <p className="font-bold text-[var(--text)] uppercase">{selectedReturn.refund_method} ({selectedReturn.refund_account_name})</p>
                  </div>
                </div>
              )}

              {/* RTO Courier Freight Fee Breakdown & Manual Adjustment */}
              {(selectedReturn.courier_fee_loss > 0 || selectedReturn.return_type === 'courier_rto') && (
                <div className="p-4 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Carrier RTO Freight Charge</span>
                        <span
                          className={`text-[8px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                            selectedReturn.courier_fee_source === 'steadfast_api'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {selectedReturn.courier_fee_source === 'steadfast_api' ? 'Steadfast API' : 'Manual Entry'}
                        </span>
                      </div>
                      <p className="text-base font-black text-[var(--status-amber)] font-num mt-0.5">
                        &#2547;{selectedReturn.courier_fee_loss.toLocaleString()}
                      </p>
                    </div>

                    {!isEditingRtoFee && (
                      <button
                        type="button"
                        onClick={() => setIsEditingRtoFee(true)}
                        className="erp-btn-secondary text-[11px] px-2 py-1"
                      >
                        Adjust RTO Fee
                      </button>
                    )}
                  </div>

                  {isEditingRtoFee && (
                    <form onSubmit={handleUpdateRtoFee} className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)] space-y-2.5">
                      <div className="font-bold text-xs text-[var(--text)]">Adjust Carrier RTO Freight Charge (Manual Fallback)</div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                          Correct RTO Fee (BDT) *
                        </label>
                        <input
                          type="number"
                          value={newRtoFeeValue}
                          onChange={(e) => setNewRtoFeeValue(Number(e.target.value))}
                          className="erp-input w-full font-num font-bold text-sm"
                          required
                          min="0"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                          Reason / Audit Notes
                        </label>
                        <input
                          type="text"
                          value={rtoFeeNotes}
                          onChange={(e) => setRtoFeeNotes(e.target.value)}
                          placeholder="e.g. Adjusted based on Steadfast monthly statement invoice"
                          className="erp-input w-full text-xs"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingRtoFee(false)}
                          className="erp-btn-secondary text-[11px]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isUpdatingRtoFee}
                          className="erp-btn-primary text-[11px]"
                        >
                          {isUpdatingRtoFee ? 'Saving...' : 'Update & Rebalance Journal'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-sunken)] flex items-center justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
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
