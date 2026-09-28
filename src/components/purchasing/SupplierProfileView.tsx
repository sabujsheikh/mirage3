import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Supplier, PurchaseOrder, SupplierPayment, PurchaseReturn } from '../../types';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { SupplierFormModal } from './SupplierFormModal';
import { SupplierPaymentModal } from './SupplierPaymentModal';

interface StatementResponse {
  supplier: Supplier;
  purchase_orders: PurchaseOrder[];
  payments: SupplierPayment[];
  returns: PurchaseReturn[];
  balance_payable: number;
}

export const SupplierProfileView: React.FC = () => {
  const { activePath, setActivePath } = useApp();
  const { sessionToken, can } = useAuth();

  const supplierId = useMemo(() => {
    const match = activePath.match(/supplier_id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }, [activePath]);

  const [statementData, setStatementData] = useState<StatementResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  const fetchStatement = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/statement`, { headers });
      if (!res.ok) {
        if (res.status === 404) throw new Error('Supplier not found');
        throw new Error('Failed to load supplier statement');
      }
      const data: StatementResponse = await res.json();
      setStatementData(data);
    } catch (err: any) {
      setError(err.message || 'Error loading supplier profile');
    } finally {
      setLoading(false);
    }
  }, [supplierId, sessionToken]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const supplier = statementData?.supplier;
  const purchaseOrders = useMemo(() => statementData?.purchase_orders || [], [statementData]);
  const payments = useMemo(() => statementData?.payments || [], [statementData]);
  const returns = useMemo(() => statementData?.returns || [], [statementData]);

  // Total purchased: count only POs with status 'ordered', 'partially_received', 'received'
  const eligiblePurchasedPos = useMemo(() => {
    return purchaseOrders.filter(p => ['ordered', 'partially_received', 'received'].includes(p.status));
  }, [purchaseOrders]);

  const totalPurchased = useMemo(() => {
    return eligiblePurchasedPos.reduce((sum, p) => sum + (p.total_amount_bdt || 0), 0);
  }, [eligiblePurchasedPos]);

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + (p.amount_bdt || 0), 0);
  }, [payments]);

  // Last purchase date
  const lastPurchaseDate = useMemo(() => {
    if (purchaseOrders.length === 0) return '-';
    const sorted = [...purchaseOrders].sort((a, b) => b.order_date.localeCompare(a.order_date));
    return sorted[0]?.order_date || '-';
  }, [purchaseOrders]);

  // Last payment date
  const lastPaymentDate = useMemo(() => {
    if (payments.length === 0) return '-';
    const sorted = [...payments].sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
    return sorted[0]?.payment_date || '-';
  }, [payments]);

  // Average lead time (only if both order date and receiving date exist in POs)
  const averageLeadTimeDays = useMemo(() => {
    const receivedWithDates = purchaseOrders.filter(p => {
      if (p.status !== 'received' && p.status !== 'partially_received') return false;
      return Boolean(p.order_date && p.expected_delivery_date);
    });
    if (receivedWithDates.length === 0) return null;

    let totalDiff = 0;
    receivedWithDates.forEach(p => {
      const orderTime = new Date(p.order_date).getTime();
      const recvTime = new Date(p.expected_delivery_date!).getTime();
      const diff = Math.max(0, Math.round((recvTime - orderTime) / (1000 * 60 * 60 * 24)));
      totalDiff += diff;
    });
    return Math.round(totalDiff / receivedWithDates.length);
  }, [purchaseOrders]);

  // Chronological ledger table
  const ledgerRows = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      type: string;
      reference: string;
      description: string;
      billed: number | null;
      paid_or_returned: number | null;
      rawDate: string;
    }> = [];

    // POs (billed) - non-cancelled POs
    purchaseOrders.forEach(po => {
      if (po.status === 'cancelled') return;
      items.push({
        id: `po-${po.id}`,
        date: po.order_date || po.created_at?.slice(0, 10) || '-',
        rawDate: po.order_date || po.created_at || '',
        type: 'Purchase order',
        reference: po.po_number,
        description: `${(po.items || []).length} items (${po.status})`,
        billed: po.total_amount_bdt || 0,
        paid_or_returned: null,
      });
    });

    // Payments
    payments.forEach(pay => {
      items.push({
        id: `pay-${pay.id}`,
        date: pay.payment_date || pay.created_at?.slice(0, 10) || '-',
        rawDate: pay.payment_date || pay.created_at || '',
        type: 'Payment',
        reference: pay.payment_number || pay.reference_no || '-',
        description: pay.reference_no ? `${pay.reference_no} (${pay.payment_account_name || 'Bank'})` : pay.payment_account_name || 'Bank',
        billed: null,
        paid_or_returned: pay.amount_bdt || 0,
      });
    });

    // Returns
    returns.forEach(ret => {
      items.push({
        id: `ret-${ret.id}`,
        date: ret.return_date || ret.created_at?.slice(0, 10) || '-',
        rawDate: ret.return_date || ret.created_at || '',
        type: 'Purchase return',
        reference: ret.return_number,
        description: ret.reason || 'Return note',
        billed: null,
        paid_or_returned: ret.total_amount_bdt || 0,
      });
    });

    // Sort ascending by date
    const sorted = [...items].sort((a, b) => a.rawDate.localeCompare(b.rawDate));

    // Calculate running balance
    let running = 0;
    return sorted.map(item => {
      if (item.billed !== null) running += item.billed;
      if (item.paid_or_returned !== null) running -= item.paid_or_returned;
      return {
        ...item,
        running_balance: running,
      };
    });
  }, [purchaseOrders, payments, returns]);

  // Products supplied derived from non-cancelled PO lines
  const productsSupplied = useMemo(() => {
    const map: Record<string, {
      productId: string;
      name: string;
      sku: string;
      unitsOrdered: number;
      unitsReceived: number;
      totalLandedBdt: number;
      lastUnitCost: number;
      lastPurchased: string;
    }> = {};

    // Sort POs ascending to track last unit cost and last purchased date
    const nonCancelledPos = purchaseOrders
      .filter(p => p.status !== 'cancelled')
      .sort((a, b) => (a.order_date || '').localeCompare(b.order_date || ''));

    nonCancelledPos.forEach(po => {
      (po.items || []).forEach(item => {
        const key = item.product_id || item.sku;
        if (!map[key]) {
          map[key] = {
            productId: item.product_id,
            name: item.product_name,
            sku: item.sku,
            unitsOrdered: 0,
            unitsReceived: 0,
            totalLandedBdt: 0,
            lastUnitCost: item.total_landed_unit_cost_bdt || item.unit_cost_bdt || 0,
            lastPurchased: po.order_date || '-',
          };
        }
        map[key].unitsOrdered += item.quantity_ordered || 0;
        map[key].unitsReceived += item.quantity_received || 0;
        const lineLanded = (item.total_landed_unit_cost_bdt || item.unit_cost_bdt || 0) * (item.quantity_ordered || 0);
        map[key].totalLandedBdt += lineLanded;
        map[key].lastUnitCost = item.total_landed_unit_cost_bdt || item.unit_cost_bdt || 0;
        map[key].lastPurchased = po.order_date || map[key].lastPurchased;
      });
    });

    return Object.values(map).sort((a, b) => b.unitsOrdered - a.unitsOrdered);
  }, [purchaseOrders]);

  if (loading) {
    return <div className="p-6 text-xs text-[var(--text-muted)]">Loading supplier profile...</div>;
  }

  if (error || !supplier) {
    return (
      <div className="space-y-3 max-w-7xl mx-auto pb-8">
        <div className="p-3 bg-[var(--negative)]/10 border border-[var(--negative)]/20 rounded-[4px] text-xs text-[var(--negative)]">
          {error || 'Supplier not found'}
        </div>
        <button
          onClick={() => setActivePath('/purchasing/suppliers')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to suppliers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-[var(--text)]">{supplier.name}</h1>
          <span className={`text-xs font-medium ${supplier.active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
            {supplier.active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {can('manage_accounting') && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded-[4px] hover:opacity-90 transition-all cursor-pointer"
            >
              Record payment
            </button>
          )}

          {can('manage_suppliers') && (
            <button
              onClick={() => setShowEditModal(true)}
              className="px-3 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-[4px] hover:bg-[var(--border)] transition-colors cursor-pointer"
            >
              Edit
            </button>
          )}

          <button
            onClick={() => setActivePath('/purchasing/suppliers')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to suppliers
          </button>
        </div>
      </div>

      {/* Data Strip */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[4px] px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Total purchased:</span>
          <span className="font-semibold tabular-nums text-[var(--text)]">৳{totalPurchased.toLocaleString()}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Total paid:</span>
          <span className="font-semibold tabular-nums text-[var(--text)]">৳{totalPaid.toLocaleString()}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Payable balance:</span>
          <span className={`font-semibold tabular-nums ${supplier.balance_payable > 0 ? 'text-[var(--negative)]' : 'text-[var(--text)]'}`}>
            ৳{supplier.balance_payable.toLocaleString()}
          </span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">POs:</span>
          <span className="font-semibold tabular-nums text-[var(--text)]">{purchaseOrders.length}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Last purchase:</span>
          <span className="tabular-nums text-[var(--text)]">{lastPurchaseDate}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Last payment:</span>
          <span className="tabular-nums text-[var(--text)]">{lastPaymentDate}</span>
        </div>
      </div>

      {/* Main Content & Side Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Main Column (Stacked, No Tabs) */}
        <div className="lg:col-span-2 space-y-3">
          {/* 1. Ledger */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[4px] overflow-hidden shadow-xs">
            <div className="px-3 py-2 bg-[var(--surface-sunken)] border-b border-[var(--border)] text-xs font-semibold text-[var(--text)]">
              Ledger
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[var(--surface-sunken)] text-[11px] font-medium text-[var(--text-muted)] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-2 px-3 whitespace-nowrap">Date</th>
                    <th className="py-2 px-3 whitespace-nowrap">Type</th>
                    <th className="py-2 px-3 whitespace-nowrap">Reference</th>
                    <th className="py-2 px-3 whitespace-nowrap">Description</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Billed</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Paid or returned</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Running balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-xs text-[var(--text-muted)]">
                        No transactions recorded for this supplier.
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map(row => (
                      <tr key={row.id} className="odd:bg-[var(--card)] even:bg-[var(--surface-sunken)]/40 hover:bg-[var(--surface-hover)]">
                        <td className="py-1.5 px-3 whitespace-nowrap tabular-nums text-[var(--text-muted)]">{row.date}</td>
                        <td className="py-1.5 px-3 whitespace-nowrap text-[var(--text)]">{row.type}</td>
                        <td className="py-1.5 px-3 whitespace-nowrap font-medium text-[var(--accent)]">{row.reference}</td>
                        <td className="py-1.5 px-3 whitespace-nowrap text-[var(--text-muted)]">{row.description}</td>
                        <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums font-medium text-[var(--text)]">
                          {row.billed !== null ? `৳${row.billed.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums font-medium text-[var(--text)]">
                          {row.paid_or_returned !== null ? `৳${row.paid_or_returned.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums font-medium text-[var(--text)]">
                          ৳{row.running_balance.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Purchase Orders */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[4px] overflow-hidden shadow-xs">
            <div className="px-3 py-2 bg-[var(--surface-sunken)] border-b border-[var(--border)] text-xs font-semibold text-[var(--text)]">
              Purchase orders
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[var(--surface-sunken)] text-[11px] font-medium text-[var(--text-muted)] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-2 px-3 whitespace-nowrap">PO number</th>
                    <th className="py-2 px-3 whitespace-nowrap">Date</th>
                    <th className="py-2 px-3 whitespace-nowrap">Warehouse</th>
                    <th className="py-2 px-3 whitespace-nowrap">Status</th>
                    <th className="py-2 px-3 whitespace-nowrap">Payment status</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Total</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Paid</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-xs text-[var(--text-muted)]">
                        No purchase orders found.
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map(po => {
                      const paid = po.amount_paid_bdt || 0;
                      const due = Math.max(0, (po.total_amount_bdt || 0) - paid);
                      const paymentStatusText = po.payment_status || (due === 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid');

                      return (
                        <tr
                          key={po.id}
                          onDoubleClick={() => setActivePath(`/purchasing/orders?po_id=${encodeURIComponent(po.id)}`)}
                          className="odd:bg-[var(--card)] even:bg-[var(--surface-sunken)]/40 hover:bg-[var(--surface-hover)] cursor-pointer"
                        >
                          <td className="py-1.5 px-3 font-medium text-[var(--accent)] whitespace-nowrap">{po.po_number}</td>
                          <td className="py-1.5 px-3 text-[var(--text-muted)] tabular-nums whitespace-nowrap">{po.order_date}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap text-[var(--text-muted)]">{po.target_warehouse_name || '-'}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap text-[var(--text)]">{po.status}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap">
                            <span
                              className={
                                paymentStatusText === 'unpaid'
                                  ? 'text-[var(--negative)]'
                                  : paymentStatusText === 'partially_paid'
                                  ? 'text-[var(--accent-secondary)]'
                                  : 'text-[var(--text)]'
                              }
                            >
                              {paymentStatusText === 'partially_paid' ? 'partially paid' : paymentStatusText}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-right tabular-nums font-medium whitespace-nowrap text-[var(--text)]">
                            ৳{(po.total_amount_bdt || 0).toLocaleString()}
                          </td>
                          <td className="py-1.5 px-3 text-right tabular-nums whitespace-nowrap text-[var(--text)]">
                            ৳{paid.toLocaleString()}
                          </td>
                          <td className={`py-1.5 px-3 text-right tabular-nums font-medium whitespace-nowrap ${due > 0 ? 'text-[var(--negative)]' : 'text-[var(--text)]'}`}>
                            ৳{due.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Products Supplied */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[4px] overflow-hidden shadow-xs">
            <div className="px-3 py-2 bg-[var(--surface-sunken)] border-b border-[var(--border)] text-xs font-semibold text-[var(--text)]">
              Products supplied
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[var(--surface-sunken)] text-[11px] font-medium text-[var(--text-muted)] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-2 px-3 whitespace-nowrap">Product</th>
                    <th className="py-2 px-3 whitespace-nowrap">SKU</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Units ordered</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Units received</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Avg landed unit cost (BDT)</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Last unit cost</th>
                    <th className="py-2 px-3 whitespace-nowrap">Last purchased</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {productsSupplied.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-xs text-[var(--text-muted)]">
                        No products ordered from this supplier yet.
                      </td>
                    </tr>
                  ) : (
                    productsSupplied.map(ps => {
                      const avgCost = ps.unitsOrdered > 0 ? Math.round(ps.totalLandedBdt / ps.unitsOrdered) : ps.lastUnitCost;
                      return (
                        <tr key={ps.sku || ps.productId} className="odd:bg-[var(--card)] even:bg-[var(--surface-sunken)]/40 hover:bg-[var(--surface-hover)]">
                          <td className="py-1.5 px-3 font-medium text-[var(--text)] whitespace-nowrap">{ps.name}</td>
                          <td className="py-1.5 px-3 text-[var(--text-muted)] whitespace-nowrap">{ps.sku}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums font-medium text-[var(--text)] whitespace-nowrap">{ps.unitsOrdered}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text)] whitespace-nowrap">{ps.unitsReceived}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text)] whitespace-nowrap">৳{avgCost.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text)] whitespace-nowrap">৳{ps.lastUnitCost.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-[var(--text-muted)] tabular-nums whitespace-nowrap">{ps.lastPurchased}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Side Column */}
        <div className="space-y-3">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[4px] p-3 space-y-2.5 text-xs">
            <div className="font-semibold text-[var(--text)] border-b border-[var(--border)] pb-1.5">
              Contact details
            </div>

            <div className="space-y-2">
              {supplier.contact_person && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)]">Contact person</div>
                  <div className="text-[var(--text)] font-medium">{supplier.contact_person}</div>
                </div>
              )}

              {supplier.phone && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)]">Phone</div>
                  <div className="text-[var(--text)] tabular-nums">{supplier.phone}</div>
                </div>
              )}

              {supplier.email && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)]">Email</div>
                  <div className="text-[var(--text)]">{supplier.email}</div>
                </div>
              )}

              {supplier.address && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)]">Address</div>
                  <div className="text-[var(--text)]">{supplier.address}</div>
                </div>
              )}

              {supplier.country && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)]">Country</div>
                  <div className="text-[var(--text)]">{supplier.country}</div>
                </div>
              )}

              {supplier.currency && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)]">Currency</div>
                  <div className="text-[var(--text)]">
                    {supplier.currency} (1 {supplier.currency} = ৳{supplier.default_exchange_rate})
                  </div>
                </div>
              )}

              {supplier.payment_terms && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)]">Payment terms</div>
                  <div className="text-[var(--text)]">{supplier.payment_terms}</div>
                </div>
              )}

              {supplier.tax_id_or_trade_license && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)]">Trade license / Tax ID</div>
                  <div className="text-[var(--text)]">{supplier.tax_id_or_trade_license}</div>
                </div>
              )}

              {averageLeadTimeDays !== null && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)]">Average lead time</div>
                  <div className="text-[var(--text)] tabular-nums">{averageLeadTimeDays} days</div>
                </div>
              )}

              {supplier.notes && (
                <div>
                  <div className="text-[11px] text-[var(--text-muted)]">Notes</div>
                  <div className="text-[var(--text)]">{supplier.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shared Modals */}
      <SupplierFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        supplier={supplier}
        onSuccess={() => fetchStatement()}
      />

      <SupplierPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        supplier={supplier}
        onSuccess={() => fetchStatement()}
      />
    </div>
  );
};
