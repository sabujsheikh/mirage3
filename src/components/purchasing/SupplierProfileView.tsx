import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../common/PageHeader';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Supplier, PurchaseOrder, SupplierPayment } from '../../types';
import { ArrowLeft, RefreshCw, Truck, Phone, Mail, MapPin, Building2, CheckCircle2 } from 'lucide-react';

export const SupplierProfileView: React.FC = () => {
  const { activePath, setActivePath } = useApp();
  const { sessionToken } = useAuth();

  const supplierId = React.useMemo(() => {
    const match = activePath.match(/supplier_id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }, [activePath]);

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSupplierData = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const [suppRes, poRes, payRes] = await Promise.all([
        fetch(`/api/suppliers/${supplierId}`, { headers }),
        fetch(`/api/purchasing/orders`, { headers }).catch(() => null),
        fetch(`/api/suppliers/${supplierId}/payments`, { headers }).catch(() => null),
      ]);

      if (!suppRes.ok) throw new Error('Supplier not found');
      const suppData = await suppRes.json();
      setSupplier(suppData);

      if (poRes && poRes.ok) {
        const pos: PurchaseOrder[] = await poRes.json();
        setPurchaseOrders(pos.filter(p => p.supplier_id === supplierId));
      }

      if (payRes && payRes.ok) {
        const pays: SupplierPayment[] = await payRes.json();
        setPayments(pays);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading supplier profile');
    } finally {
      setLoading(false);
    }
  }, [supplierId, sessionToken]);

  useEffect(() => {
    fetchSupplierData();
  }, [fetchSupplierData]);

  if (loading) {
    return <div className="p-8 text-xs text-[var(--text-muted)] font-mono">Loading supplier profile...</div>;
  }

  if (error || !supplier) {
    return (
      <div className="p-8 space-y-4 max-w-7xl mx-auto">
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded text-xs font-semibold">
          {error || 'Supplier not found'}
        </div>
        <button
          onClick={() => setActivePath('/purchasing/suppliers')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-xs font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Suppliers
        </button>
      </div>
    );
  }

  const totalPurchased = purchaseOrders.reduce((s, p) => s + p.total_amount_bdt, 0);
  const lastPo = purchaseOrders.sort((a, b) => b.order_date.localeCompare(a.order_date))[0];

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto pb-8">
      <PageHeader
        eyebrow="Supplier profile"
        title={supplier.name}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePath('/purchasing/suppliers')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Directory
            </button>
            <button
              onClick={fetchSupplierData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Header Info Strip */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-md px-3 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Country:</span>{' '}
            <span className="font-bold text-[var(--text)]">{supplier.country}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Currency:</span>{' '}
            <span className="font-bold text-[var(--text)]">{supplier.currency}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Terms:</span>{' '}
            <span className="font-bold text-[var(--text)]">{supplier.payment_terms}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Status:</span>{' '}
            <span className={`font-bold uppercase px-1.5 py-0.5 rounded ${supplier.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
              {supplier.active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Data Strip */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-md px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px] font-sans">Total Purchased (BDT):</span>
          <span className="font-bold text-[var(--text)]">৳{totalPurchased.toLocaleString()}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px] font-sans">Payable Balance:</span>
          <span className={`font-bold ${supplier.balance_payable > 0 ? 'text-[var(--negative)]' : 'text-[var(--text)]'}`}>৳{supplier.balance_payable.toLocaleString()}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px] font-sans">PO Count:</span>
          <span className="font-bold text-[var(--text)]">{purchaseOrders.length}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px] font-sans">Last Purchase Date:</span>
          <span className="font-bold text-[var(--text)]">{lastPo ? lastPo.order_date : '-'}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {/* Purchase Orders Table */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden shadow-xs">
            <div className="px-3 py-2 bg-[var(--surface-sunken)] border-b border-[var(--border)] text-xs font-bold text-[var(--text)]">
              Purchase Orders ({purchaseOrders.length})
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead className="sticky top-0 bg-[var(--surface-sunken)] text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border)]">
                  <tr>
                    <th className="py-2 px-3">PO Number</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Warehouse</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Total (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {purchaseOrders.map(po => (
                    <tr key={po.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="py-2 px-3 font-bold text-[var(--accent)]">{po.po_number}</td>
                      <td className="py-2 px-3 text-[var(--text-muted)]">{po.order_date}</td>
                      <td className="py-2 px-3">{po.target_warehouse_name}</td>
                      <td className="py-2 px-3 uppercase text-[10px]">{po.status}</td>
                      <td className="py-2 px-3 text-right font-bold">৳{po.total_amount_bdt.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Side Column */}
        <div className="space-y-3">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 space-y-2">
            <div className="text-xs font-bold text-[var(--text)]">Contact Details</div>
            <div className="space-y-1 text-xs font-mono">
              <div><span className="text-[var(--text-muted)]">Contact Person:</span> {supplier.contact_person || '-'}</div>
              <div><span className="text-[var(--text-muted)]">Phone:</span> {supplier.phone || '-'}</div>
              <div><span className="text-[var(--text-muted)]">Email:</span> {supplier.email || '-'}</div>
              <div><span className="text-[var(--text-muted)]">Address:</span> {supplier.address || '-'}</div>
              {supplier.tax_id_or_trade_license && (
                <div><span className="text-[var(--text-muted)]">Trade License:</span> {supplier.tax_id_or_trade_license}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
