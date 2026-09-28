import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Building2,
  Calendar,
  Eye,
  Trash2,
  Printer,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  TrendingDown,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { CourierSettlementBatch, SettlementBatchItem, CourierBooking } from '../../types';
import { Modal } from '../common/Modal';

export interface EditableBatchItem extends SettlementBatchItem {
  included?: boolean;
}

export const CourierSettlementBatchesTab: React.FC = () => {
  const { courierBookings, accounts, refreshAll } = useApp();
  const { currentUser, can } = useAuth();

  const [batches, setBatches] = useState<CourierSettlementBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted'>('all');

  // New / Edit Batch Modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<CourierSettlementBatch | null>(null);
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchEndDate, setBatchEndDate] = useState('');
  const [depositAccountId, setDepositAccountId] = useState('acc_bank');
  const [bankReference, setBankReference] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [actualPayoutReceived, setActualPayoutReceived] = useState<number>(0);
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [selectedItems, setSelectedItems] = useState<EditableBatchItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // View / Print Voucher Modal
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingBatch, setViewingBatch] = useState<CourierSettlementBatch | null>(null);

  // Fetch batches
  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/courier/settlement-batches');
      if (res.ok) {
        const data = await res.json();
        setBatches(data);
      }
    } catch (err) {
      console.error('Failed to load settlement batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  // Initialize Default Dates
  const initDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  };

  // Open Create Batch Modal
  const handleOpenCreateModal = () => {
    const { start, end } = initDefaultDates();
    setBatchStartDate(start);
    setBatchEndDate(end);
    setDepositAccountId('acc_bank');
    setBankReference(`ST-ADV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
    setBatchNotes('');
    setDiscrepancyReason('');
    setFormError(null);
    setEditingBatch(null);

    // Populate unsettled bookings within date range
    populateItemsFromBookings(start, end);
    setIsBatchModalOpen(true);
  };

  // Populate items from unsettled bookings
  const populateItemsFromBookings = (start: string, end: string) => {
    const sDate = new Date(start);
    sDate.setHours(0, 0, 0, 0);
    const eDate = new Date(end);
    eDate.setHours(23, 59, 59, 999);

    // Eligible bookings: Steadfast courier, not already reconciled, status is delivered or rto
    const eligibleBookings = courierBookings.filter((b) => {
      if (b.payout_status === 'reconciled') return false;
      const bDate = new Date(b.created_at || b.booked_at || Date.now());
      if (bDate < sDate || bDate > eDate) return false;
      return b.status === 'delivered' || b.status === 'rto';
    });

    const items: EditableBatchItem[] = eligibleBookings.map((b) => {
      const isRTO = b.status === 'rto';
      const customerDelivery = b.delivery_charge || 70;
      const actualCourier = b.actual_charge != null ? b.actual_charge : (isRTO ? 100 : 70);
      const expectedCod = b.cod_amount || 0;
      const actualCod = isRTO ? 0 : expectedCod;
      const netPayout = actualCod - actualCourier;
      const variance = customerDelivery - actualCourier;

      return {
        booking_id: b.id,
        order_id: b.order_id,
        consignment_no: b.consignment_no,
        invoice_number: b.invoice_number,
        customer_name: b.customer_name,
        customer_phone: b.customer_phone,
        status: b.status,
        customer_delivery_charge: customerDelivery,
        actual_courier_charge: actualCourier,
        expected_cod: expectedCod,
        actual_cod_collected: actualCod,
        net_payout: netPayout,
        variance: variance,
        is_rto: isRTO,
        included: true,
      };
    });

    setSelectedItems(items);
    const calculatedNet = items.reduce((sum, item) => sum + item.net_payout, 0);
    setActualPayoutReceived(calculatedNet);
  };

  // Open Edit Batch
  const handleOpenEditModal = (batch: CourierSettlementBatch) => {
    setEditingBatch(batch);
    setBatchStartDate(batch.date_from);
    setBatchEndDate(batch.date_to);
    setDepositAccountId(batch.deposit_account_id);
    setBankReference(batch.deposit_reference || '');
    setBatchNotes(batch.notes || '');
    setDiscrepancyReason(batch.discrepancy_notes || '');
    setActualPayoutReceived(batch.actual_bank_payout);
    setSelectedItems((batch.items || []).map((i) => ({ ...i, included: true })));
    setFormError(null);
    setIsBatchModalOpen(true);
  };

  // Handle item change in modal
  const handleItemChange = (
    index: number,
    field: 'actual_courier_charge' | 'actual_cod_collected' | 'included',
    value: any
  ) => {
    setSelectedItems((prev) => {
      const next = [...prev];
      const target = { ...next[index] };

      if (field === 'included') {
        target.included = value;
      } else if (field === 'actual_courier_charge') {
        target.actual_courier_charge = Math.max(0, Number(value));
      } else if (field === 'actual_cod_collected') {
        target.actual_cod_collected = Math.max(0, Number(value));
      }

      target.net_payout = target.actual_cod_collected - target.actual_courier_charge;
      target.variance = target.customer_delivery_charge - target.actual_courier_charge;
      next[index] = target;

      // Update actual payout suggestion if matching calculated
      const active = next.filter((i) => i.included);
      const newCalcNet = active.reduce((sum, i) => sum + i.net_payout, 0);
      setActualPayoutReceived(newCalcNet);

      return next;
    });
  };

  // Calculations for current form
  const activeItems = selectedItems.filter((i) => i.included);
  const calcGrossCod = activeItems.reduce((sum, i) => sum + i.actual_cod_collected, 0);
  const calcCourierCharges = activeItems.reduce((sum, i) => sum + i.actual_courier_charge, 0);
  const calcNetPayout = calcGrossCod - calcCourierCharges;
  const discrepancy = actualPayoutReceived - calcNetPayout;

  // Save Batch Draft
  const handleSaveDraft = async () => {
    if (activeItems.length === 0) {
      setFormError('Please include at least one consignment in the settlement batch.');
      return;
    }

    try {
      setIsSaving(true);
      setFormError(null);

      const url = editingBatch
        ? `/api/courier/settlement-batches/${editingBatch.id}`
        : '/api/courier/settlement-batches';
      const method = editingBatch ? 'PUT' : 'POST';

      const payload = editingBatch
        ? {
            deposit_account_id: depositAccountId,
            deposit_reference: bankReference,
            notes: batchNotes,
            actual_bank_payout: actualPayoutReceived,
            discrepancy_notes: discrepancyReason,
            items: activeItems.map((i) => ({
              booking_id: i.booking_id,
              order_id: i.order_id,
              invoice_number: i.invoice_number,
              consignment_no: i.consignment_no,
              customer_name: i.customer_name,
              customer_phone: i.customer_phone,
              status: i.status,
              expected_cod: i.expected_cod,
              actual_cod_collected: i.actual_cod_collected,
              customer_delivery_charge: i.customer_delivery_charge,
              actual_courier_charge: i.actual_courier_charge,
              variance: i.variance,
              net_payout: i.net_payout,
              is_rto: i.is_rto,
              notes: i.notes,
            })),
          }
        : {
            carrier: 'steadfast',
            date_from: batchStartDate,
            date_to: batchEndDate,
            deposit_account_id: depositAccountId,
            deposit_reference: bankReference,
            notes: batchNotes,
            actual_bank_payout: actualPayoutReceived,
            discrepancy_notes: discrepancyReason,
            booking_ids: activeItems.map((i) => i.booking_id),
            item_overrides: activeItems.map((i) => ({
              booking_id: i.booking_id,
              actual_cod_collected: i.actual_cod_collected,
              actual_courier_charge: i.actual_courier_charge,
              notes: i.notes,
            })),
          };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-authenticated-user-id': currentUser?.id || '',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save batch');
      }

      await fetchBatches();
      await refreshAll();
      setIsBatchModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Error saving batch');
    } finally {
      setIsSaving(false);
    }
  };

  // Post & Finalize Batch
  const handlePostBatch = async (batchId?: string) => {
    const idToPost = batchId || editingBatch?.id;
    if (!idToPost && !editingBatch) {
      // Must save first if creating
      if (activeItems.length === 0) {
        setFormError('Please include at least one consignment before posting.');
        return;
      }
    }

    const confirmMsg =
      'Are you sure you want to finalize and post this Settlement Batch?\n\n' +
      'This will:\n' +
      '1. Post an atomic double-entry journal entry to General Ledger\n' +
      '2. Debit the Deposit Account for bank payout\n' +
      '3. Debit Courier Freight Expense for courier charges\n' +
      '4. Credit Courier Receivable for individual orders\n' +
      '5. Post any discrepancy to Courier Discrepancy Account 6035\n' +
      '6. Mark all included consignments as RECONCILED';

    if (!window.confirm(confirmMsg)) return;

    try {
      setIsPosting(true);
      setFormError(null);

      let targetId = idToPost;

      // If in create modal, save first
      if (!targetId) {
        const payload = {
          carrier: 'steadfast',
          date_from: batchStartDate,
          date_to: batchEndDate,
          deposit_account_id: depositAccountId,
          deposit_reference: bankReference,
          notes: batchNotes,
          actual_bank_payout: actualPayoutReceived,
          discrepancy_notes: discrepancyReason,
          booking_ids: activeItems.map((i) => i.booking_id),
          item_overrides: activeItems.map((i) => ({
            booking_id: i.booking_id,
            actual_cod_collected: i.actual_cod_collected,
            actual_courier_charge: i.actual_courier_charge,
            notes: i.notes,
          })),
        };

        const res = await fetch('/api/courier/settlement-batches', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-authenticated-user-id': currentUser?.id || '',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to save batch prior to posting');
        }

        const savedBatch = await res.json();
        targetId = savedBatch.id;
      }

      // Post the batch
      const postRes = await fetch(`/api/courier/settlement-batches/${targetId}/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-authenticated-user-id': currentUser?.id || '',
        },
        body: JSON.stringify({
          deposit_account_id: depositAccountId,
          deposit_reference: bankReference,
          actual_bank_payout: actualPayoutReceived,
          discrepancy_notes: discrepancyReason,
        }),
      });

      if (!postRes.ok) {
        const err = await postRes.json();
        throw new Error(err.error || 'Failed to post settlement batch');
      }

      await fetchBatches();
      await refreshAll();
      setIsBatchModalOpen(false);
      alert('Settlement batch posted successfully! Journal entry created.');
    } catch (err: any) {
      setFormError(err.message || 'Error posting batch');
    } finally {
      setIsPosting(false);
    }
  };

  // Delete Draft
  const handleDeleteDraft = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to delete this draft batch?')) return;
    try {
      const res = await fetch(`/api/courier/settlement-batches/${batchId}`, {
        method: 'DELETE',
        headers: { 'x-authenticated-user-id': currentUser?.id || '' },
      });
      if (res.ok) {
        await fetchBatches();
      }
    } catch (err) {
      console.error('Failed to delete batch:', err);
    }
  };

  // Summary Metrics across all batches
  const postedBatches = batches.filter((b) => b.status === 'posted');
  const totalSettledCount = postedBatches.length;
  const totalBankReceived = postedBatches.reduce((sum, b) => sum + (b.actual_bank_payout || 0), 0);
  const totalCourierExp = postedBatches.reduce((sum, b) => sum + (b.total_actual_courier_charges || 0), 0);
  const totalDiscrepancy = postedBatches.reduce((sum, b) => sum + (b.discrepancy_amount || 0), 0);

  // Filtered batches
  const filteredBatches = batches.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchNo = b.batch_number?.toLowerCase().includes(term);
      const matchRef = b.deposit_reference?.toLowerCase().includes(term);
      const matchNotes = b.notes?.toLowerCase().includes(term);
      return matchNo || matchRef || matchNotes;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] shadow-xs">
        <div>
          <h2 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--accent)]" />
            Weekly Courier Settlement &amp; Reconciliation Batches
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 max-w-2xl">
            Reconcile Steadfast weekly payment disbursements item-by-item against individual order consignments,
            record actual freight deductions, post deposit settlements directly to General Ledger, and route unexplained
            variances to Account 6035.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchBatches}
            disabled={loading}
            className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-sunken)] text-[var(--text-secondary)] transition-colors cursor-pointer"
            title="Refresh Batches"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 rounded-lg bg-[var(--accent)] hover:opacity-90 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Settlement Batch</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)] uppercase">
            <span>Settled Batches</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-num text-[var(--text)] mt-1.5">
            {totalSettledCount}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            {batches.filter((b) => b.status === 'draft').length} Drafts Pending
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)] uppercase">
            <span>Bank Deposits Received</span>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-num text-emerald-600 dark:text-emerald-400 mt-1.5">
            ৳{totalBankReceived.toLocaleString()}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            Net payout cleared to accounts
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)] uppercase">
            <span>Courier Freight Deductions</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold font-num text-amber-600 dark:text-amber-400 mt-1.5">
            ৳{totalCourierExp.toLocaleString()}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            Debited to Courier Freight (6030)
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)] uppercase">
            <span>Discrepancy Balance (6035)</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold font-num text-[var(--text)] mt-1.5">
            {totalDiscrepancy !== 0 ? (
              <span className={totalDiscrepancy > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {totalDiscrepancy > 0 ? '+' : ''}৳{totalDiscrepancy.toLocaleString()}
              </span>
            ) : (
              <span className="text-[var(--text-secondary)]">৳0.00</span>
            )}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            Net unexplained carrier variances
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[var(--surface-sunken)] p-1 rounded-lg border border-[var(--border)] text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            All ({batches.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              statusFilter === 'draft'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            Drafts ({batches.filter((b) => b.status === 'draft').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('posted')}
            className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              statusFilter === 'posted'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            Posted ({batches.filter((b) => b.status === 'posted').length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search batch #, bank ref, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th>Batch #</th>
                <th>Period</th>
                <th>Consignments</th>
                <th className="text-right">Gross COD</th>
                <th className="text-right">Courier Fee</th>
                <th className="text-right">Bank Payout</th>
                <th className="text-right">Variance</th>
                <th>Status</th>
                <th>Bank Ref / Journal</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-[var(--text-secondary)]">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30 text-[var(--text-secondary)]" />
                    No settlement batches found. Click "Create Settlement Batch" to generate one.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--surface-sunken)]/50 transition-colors">
                    <td>
                      <div className="font-bold text-xs text-[var(--text)] font-mono">{b.batch_number}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">
                        {new Date(b.created_at).toLocaleDateString()} by {b.created_by_name}
                      </div>
                    </td>
                    <td className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
                      {b.date_from} <span className="opacity-40">→</span> {b.date_to}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-bold font-num text-[var(--text)]">{b.total_orders}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          ({b.total_delivered_orders} deliv, {b.total_rto_orders} RTO)
                        </span>
                      </div>
                    </td>
                    <td className="text-right font-num font-semibold text-xs text-[var(--text)]">
                      ৳{(b.total_expected_cod || 0).toLocaleString()}
                    </td>
                    <td className="text-right font-num font-semibold text-xs text-amber-600 dark:text-amber-400">
                      ৳{(b.total_actual_courier_charges || 0).toLocaleString()}
                    </td>
                    <td className="text-right font-num font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      ৳{(b.actual_bank_payout || 0).toLocaleString()}
                    </td>
                    <td className="text-right font-num text-xs">
                      {b.discrepancy_amount !== 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold text-[10px]">
                          {b.discrepancy_amount > 0 ? '+' : ''}৳{b.discrepancy_amount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-secondary)]">৳0 (Balanced)</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          b.status === 'posted'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--text-secondary)]">
                      <div className="font-mono text-[11px]">{b.deposit_reference || '—'}</div>
                      {b.journal_entry_id && (
                        <div className="text-[10px] text-[var(--accent)] font-semibold">
                          JRN: {b.journal_entry_id}
                        </div>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setViewingBatch(b);
                            setIsViewModalOpen(true);
                          }}
                          className="px-2 py-1 rounded bg-[var(--surface-sunken)] hover:bg-[var(--border)] text-xs text-[var(--text)] flex items-center gap-1 cursor-pointer"
                          title="View Settlement Advice"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Advice</span>
                        </button>

                        {b.status === 'draft' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(b)}
                              className="px-2 py-1 rounded bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              Edit / Post
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDraft(b.id)}
                              className="p-1 rounded text-rose-500 hover:bg-rose-500/15 cursor-pointer"
                              title="Delete Draft"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT BATCH MODAL */}
      {isBatchModalOpen && (
        <Modal
          open={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          size="xl"
          title={editingBatch ? `Edit Settlement Batch: ${editingBatch.batch_number}` : 'Create Weekly Courier Settlement Batch'}
          subtitle="Reconcile Steadfast courier payout disbursements item-by-item against individual order consignments"
        >
          <div className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Top Parameters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[var(--surface-sunken)] p-3 rounded-xl border border-[var(--border)] text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={batchStartDate}
                  onChange={(e) => setBatchStartDate(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-num"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  End Date
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="date"
                    value={batchEndDate}
                    onChange={(e) => setBatchEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-num"
                  />
                  <button
                    type="button"
                    onClick={() => populateItemsFromBookings(batchStartDate, batchEndDate)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white font-bold text-xs shrink-0 cursor-pointer"
                    title="Re-fetch bookings in this date window"
                  >
                    Fetch
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Deposit Account (Bank/MFS)
                </label>
                <select
                  value={depositAccountId}
                  onChange={(e) => setDepositAccountId(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                >
                  <option value="acc_bank">City Bank Account [1020]</option>
                  <option value="acc_bkash">bKash Merchant [1030]</option>
                  <option value="acc_nagad">Nagad Merchant [1035]</option>
                  <option value="acc_cash">Cash Till [1010]</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Payout Ref / Bank Statement #
                </label>
                <input
                  type="text"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  placeholder="e.g. ST-PAY-2026-03-08"
                  className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono"
                />
              </div>
            </div>

            {/* Consignments Selection & Adjustment Table */}
            <div className="border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="p-2.5 bg-[var(--surface-sunken)] border-b border-[var(--border)] flex items-center justify-between text-xs">
                <div className="font-bold text-[var(--text)] flex items-center gap-2">
                  <span>Included Consignments ({activeItems.length} of {selectedItems.length})</span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Verify Steadfast actual freight &amp; collected COD per parcel
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto">
                <table className="dense-table w-full text-xs">
                  <thead>
                    <tr>
                      <th className="w-8">
                        <input
                          type="checkbox"
                          checked={selectedItems.length > 0 && selectedItems.every((i) => i.included)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedItems((prev) => prev.map((i) => ({ ...i, included: checked })));
                            const active = selectedItems.map((i) => ({ ...i, included: checked })).filter((i) => i.included);
                            setActualPayoutReceived(active.reduce((sum, i) => sum + i.net_payout, 0));
                          }}
                          className="rounded cursor-pointer"
                        />
                      </th>
                      <th>Consignment #</th>
                      <th>Invoice / Customer</th>
                      <th>Status</th>
                      <th className="text-right">Cust. Deliv (৳)</th>
                      <th className="text-right">Actual Courier Fee (৳)</th>
                      <th className="text-right">Expected COD</th>
                      <th className="text-right">Actual COD (৳)</th>
                      <th className="text-right">Net Payout</th>
                      <th className="text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                          No delivered or RTO consignments found in this date range. Adjust dates and click "Fetch".
                        </td>
                      </tr>
                    ) : (
                      selectedItems.map((item, idx) => (
                        <tr key={item.booking_id} className={!item.included ? 'opacity-40 bg-[var(--surface-sunken)]' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={item.included}
                              onChange={(e) => handleItemChange(idx, 'included', e.target.checked)}
                              className="rounded cursor-pointer"
                            />
                          </td>
                          <td className="font-mono text-xs font-semibold">{item.consignment_no}</td>
                          <td className="text-xs">
                            <div className="font-bold text-[var(--text)]">{item.invoice_number}</div>
                            <div className="text-[10px] text-[var(--text-secondary)]">{item.customer_name}</div>
                          </td>
                          <td>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                item.status === 'delivered'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="text-right font-num text-xs text-[var(--text-secondary)]">
                            ৳{item.customer_delivery_charge}
                          </td>
                          <td className="text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.actual_courier_charge}
                              disabled={!item.included}
                              onChange={(e) => handleItemChange(idx, 'actual_courier_charge', e.target.value)}
                              className="w-16 px-1.5 py-0.5 text-right font-num font-semibold text-xs rounded border border-[var(--border)] bg-[var(--surface)] text-amber-700 dark:text-amber-400"
                            />
                          </td>
                          <td className="text-right font-num text-xs text-[var(--text-secondary)]">
                            ৳{item.expected_cod.toLocaleString()}
                          </td>
                          <td className="text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.actual_cod_collected}
                              disabled={!item.included || item.status === 'rto'}
                              onChange={(e) => handleItemChange(idx, 'actual_cod_collected', e.target.value)}
                              className="w-20 px-1.5 py-0.5 text-right font-num font-semibold text-xs rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                            />
                          </td>
                          <td className="text-right font-num font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            ৳{item.net_payout.toLocaleString()}
                          </td>
                          <td className="text-right font-num text-[11px]">
                            <span
                              className={
                                item.variance >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                  : 'text-rose-600 dark:text-rose-400 font-semibold'
                              }
                            >
                              {item.variance >= 0 ? '+' : ''}৳{item.variance}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Settlement Reconciliation & Discrepancy Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[var(--surface-sunken)] p-3.5 rounded-lg border border-[var(--border)] text-xs">
              <div className="space-y-2">
                <div className="font-bold text-[var(--text)] uppercase text-[11px] flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Batch Settlement Math (Steadfast vs. Bank)</span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between py-0.5 border-b border-[var(--border)]">
                    <span className="text-[var(--text-secondary)]">Gross COD Collected:</span>
                    <span className="font-num font-bold text-[var(--text)]">৳{calcGrossCod.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-[var(--border)]">
                    <span className="text-[var(--text-secondary)]">Courier Deductions (Freight + RTO):</span>
                    <span className="font-num font-bold text-amber-600 dark:text-amber-400">-৳{calcCourierCharges.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-[var(--border)]">
                    <span className="text-[var(--text-secondary)] font-semibold">Calculated Net Settlement Payout:</span>
                    <span className="font-num font-bold text-emerald-600 dark:text-emerald-400">৳{calcNetPayout.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="font-bold text-[var(--text)]">Actual Bank Payout Received:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text-secondary)]">৳</span>
                      <input
                        type="number"
                        value={actualPayoutReceived}
                        onChange={(e) => setActualPayoutReceived(Number(e.target.value))}
                        className="w-28 px-2 py-1 text-right font-num font-bold text-xs rounded border border-[var(--border)] bg-[var(--surface)] text-emerald-700 dark:text-emerald-300"
                      />
                    </div>
                  </div>
                </div>

                {discrepancy !== 0 && (
                  <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 space-y-1.5">
                    <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 font-bold">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Unexplained Variance:</span>
                      </span>
                      <span className="font-num font-bold">
                        {discrepancy > 0 ? '+' : ''}৳{discrepancy.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      Will be posted to <strong>Courier Discrepancy (Account 6035)</strong> to safeguard individual order balances.
                    </p>
                    <input
                      type="text"
                      placeholder="Explain reason for discrepancy (e.g. unknown weight penalty)..."
                      value={discrepancyReason}
                      onChange={(e) => setDiscrepancyReason(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-rose-300 dark:border-rose-800 bg-[var(--surface)] text-[var(--text)]"
                    />
                  </div>
                )}
              </div>

              {/* Explanatory Accounting Notes */}
              <div className="space-y-2 border-l border-[var(--border)] pl-3">
                <div className="font-bold text-[var(--text)] uppercase text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Double-Entry Posting Preview</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Finalizing this batch triggers an atomic double-entry journal entry to the General Ledger:
                </p>
                <div className="font-mono text-[10px] space-y-1 bg-[var(--surface)] p-2 rounded border border-[var(--border)]">
                  <div className="text-emerald-700 dark:text-emerald-400">
                    Dr. {depositAccountId === 'acc_bkash' ? 'bKash Merchant [1030]' : depositAccountId === 'acc_nagad' ? 'Nagad Merchant [1035]' : 'City Bank [1020]'}: ৳{actualPayoutReceived.toLocaleString()}
                  </div>
                  <div className="text-amber-700 dark:text-amber-400">
                    Dr. Courier Freight Expense [6030]: ৳{calcCourierCharges.toLocaleString()}
                  </div>
                  {discrepancy !== 0 && (
                    <div className={discrepancy > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                      {discrepancy > 0 ? 'Cr.' : 'Dr.'} Courier Discrepancy [6035]: ৳{Math.abs(discrepancy).toLocaleString()}
                    </div>
                  )}
                  <div className="text-slate-600 dark:text-slate-400">
                    Cr. Courier Receivable [1100]: ৳{calcGrossCod.toLocaleString()} (Itemized per Order)
                  </div>
                </div>
                <textarea
                  rows={2}
                  placeholder="Optional batch notes / audit references..."
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSaving || isPosting}
                  onClick={handleSaveDraft}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-sunken)] text-[var(--text)] transition-colors cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                  type="button"
                  disabled={isSaving || isPosting || activeItems.length === 0}
                  onClick={() => handlePostBatch()}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isPosting ? 'Posting...' : 'Post & Finalize Batch'}</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* VIEW / PRINT SETTLEMENT ADVICE MODAL */}
      {isViewModalOpen && viewingBatch && (
        <Modal
          open={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          size="lg"
          title={`Settlement Advice: ${viewingBatch.batch_number}`}
          subtitle={`Disbursed ${viewingBatch.date_from} to ${viewingBatch.date_to}`}
        >
          <div className="space-y-4 text-xs">
            {/* Advice Header */}
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm text-[var(--text)]">Mirage Perfume ERP</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">Courier Disbursement &amp; Reconciliation Advice</p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      viewingBatch.status === 'posted'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {viewingBatch.status}
                  </span>
                  <div className="text-xs font-mono font-bold mt-1 text-[var(--text)]">
                    {viewingBatch.batch_number}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs bg-[var(--surface-sunken)] p-2.5 rounded-lg">
                <div>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Carrier</span>
                  <span className="font-bold text-[var(--text)] uppercase">{viewingBatch.carrier}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Date Period</span>
                  <span className="font-medium text-[var(--text)]">
                    {viewingBatch.date_from} to {viewingBatch.date_to}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Bank Reference</span>
                  <span className="font-mono text-[var(--text)]">{viewingBatch.deposit_reference || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Journal Entry</span>
                  <span className="font-mono font-bold text-[var(--accent)]">
                    {viewingBatch.journal_entry_id || 'Draft (Unposted)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs">
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Consignments</span>
                <span className="font-num font-bold text-sm text-[var(--text)]">
                  {viewingBatch.total_orders}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Gross COD Collected</span>
                <span className="font-num font-bold text-sm text-[var(--text)]">
                  ৳{(viewingBatch.total_expected_cod || 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Freight / RTO Fees</span>
                <span className="font-num font-bold text-sm text-amber-600 dark:text-amber-400">
                  -৳{(viewingBatch.total_actual_courier_charges || 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Actual Bank Deposit</span>
                <span className="font-num font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  ৳{(viewingBatch.actual_bank_payout || 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase block">Variance (6035)</span>
                <span
                  className={`font-num font-bold text-sm ${
                    viewingBatch.discrepancy_amount !== 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  ৳{(viewingBatch.discrepancy_amount || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="p-2 bg-[var(--surface-sunken)] font-bold text-xs text-[var(--text)]">
                Itemized Consignment Detail
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="dense-table w-full text-xs">
                  <thead>
                    <tr>
                      <th>Consignment #</th>
                      <th>Invoice #</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th className="text-right">Actual Fee</th>
                      <th className="text-right">COD Collected</th>
                      <th className="text-right">Net Payout</th>
                      <th className="text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingBatch.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="font-mono text-xs">{item.consignment_no}</td>
                        <td className="font-bold text-xs">{item.invoice_number}</td>
                        <td className="text-xs">{item.customer_name}</td>
                        <td>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              item.status === 'delivered'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="text-right font-num text-amber-600 dark:text-amber-400">
                          ৳{item.actual_courier_charge}
                        </td>
                        <td className="text-right font-num">৳{item.actual_cod_collected.toLocaleString()}</td>
                        <td className="text-right font-num font-bold text-emerald-600 dark:text-emerald-400">
                          ৳{item.net_payout.toLocaleString()}
                        </td>
                        <td className="text-right font-num text-[11px]">
                          <span
                            className={
                              item.variance >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            {item.variance >= 0 ? '+' : ''}৳{item.variance}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Double-Entry GL Breakdown Note */}
            <div className="p-3 bg-[var(--surface-sunken)] rounded-lg border border-[var(--border)] text-xs space-y-1.5">
              <div className="font-bold text-[var(--text)] uppercase text-[11px]">
                Double-Entry Accounting Execution
              </div>
              <div className="font-mono text-[11px] text-[var(--text-secondary)] space-y-0.5">
                <div>• Dr. {paymentAccountLabel(viewingBatch.deposit_account_id)}: ৳{(viewingBatch.actual_bank_payout || 0).toLocaleString()} (Bank Inflow)</div>
                <div>• Dr. Courier Freight Expense [6030]: ৳{(viewingBatch.total_actual_courier_charges || 0).toLocaleString()} (Carrier Deductions)</div>
                {viewingBatch.discrepancy_amount !== 0 && (
                  <div>• {viewingBatch.discrepancy_amount > 0 ? 'Cr.' : 'Dr.'} Courier Discrepancy [6035]: ৳{Math.abs(viewingBatch.discrepancy_amount || 0).toLocaleString()} ({viewingBatch.discrepancy_notes || 'Unitemized Variance'})</div>
                )}
                <div>• Cr. Courier Receivable [1100]: ৳{(viewingBatch.total_expected_cod || 0).toLocaleString()} (Itemized per Consignment)</div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

function paymentAccountLabel(id: string): string {
  if (id === 'acc_bkash') return 'bKash Merchant [1030]';
  if (id === 'acc_nagad') return 'Nagad Merchant [1035]';
  if (id === 'acc_bank') return 'City Bank [1020]';
  if (id === 'acc_cash') return 'Cash on Hand [1010]';
  return id;
}
