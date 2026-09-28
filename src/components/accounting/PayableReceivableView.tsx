import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Supplier, CourierBooking } from '../../types';
import {
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  Truck,
  Building2,
  RefreshCw,
} from 'lucide-react';

export const PayableReceivableView: React.FC = () => {
  const { sessionToken } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [courierBookings, setCourierBookings] = useState<CourierBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payables' | 'receivables'>('payables');

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('mirage_session_token') : null);
      const headers = token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {};
      const [suppRes, recRes] = await Promise.all([
        fetch('/api/suppliers', { headers }),
        fetch('/api/accounting/reconciliation', { headers }),
      ]);

      if (suppRes.ok) {
        const suppData = await suppRes.json();
        setSuppliers(Array.isArray(suppData) ? suppData : []);
      }
      if (recRes.ok) {
        const recData = await recRes.json();
        if (recData && Array.isArray(recData.bookings)) setCourierBookings(recData.bookings);
      }
    } catch (err) {
      console.error('Error fetching AP/AR data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sessionToken]);

  // Compute Payables (Supplier balances)
  const payablesList = useMemo(() => {
    return (suppliers || [])
      .map((s) => ({
        id: s.id,
        supplier_name: s.name,
        contact_person: s.contact_person,
        phone: s.phone,
        balance_due: s.balance_payable || 0,
        country: s.country,
        currency: s.currency,
        active: s.active,
      }))
      .filter((p) => p.balance_due > 0);
  }, [suppliers]);

  // Compute Receivables (Courier COD pending payout)
  const receivablesList = useMemo(() => {
    return (courierBookings || [])
      .filter((b) => b && (b.status === 'delivered' || b.status === 'in_transit'))
      .map((b) => {
        const codAmount = b.cod_amount || 0;
        const fee = b.actual_charge || b.delivery_charge || 70;
        const netReceivable = Math.max(0, codAmount - fee);
        return {
          id: b.id,
          entity: `Steadfast Courier (${b.consignment_no || b.id})`,
          order_id: b.order_id,
          recipient: b.customer_name,
          amount: codAmount,
          courier_charge: fee,
          net_receivable: netReceivable,
          booked_at: b.booked_at,
          status: b.status,
        };
      });
  }, [courierBookings]);

  const totalPayables = useMemo(() => {
    return payablesList.reduce((acc, p) => acc + p.balance_due, 0);
  }, [payablesList]);

  const totalReceivables = useMemo(() => {
    return receivablesList.reduce((acc, r) => acc + r.net_receivable, 0);
  }, [receivablesList]);

  const netBalance = totalReceivables - totalPayables;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">Payables & Receivables (AP / AR)</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
              Accrual Ledger
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Track outstanding supplier obligations (Accounts Payable) and pending courier COD disbursements (Accounts Receivable).
          </p>
        </div>

        <button
          onClick={fetchData}
          className="p-2 self-start sm:self-auto border border-[var(--border)] rounded-lg hover:bg-[var(--accent)]/10 text-[var(--text-muted)] hover:text-[var(--text)] transition-all cursor-pointer"
          title="Refresh AP/AR ledger"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Receivables */}
        <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Total Receivables (AR)</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ArrowDownLeft className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-500 font-mono">৳{totalReceivables.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Pending COD payouts from Steadfast Courier
          </div>
        </div>

        {/* Total Payables */}
        <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Total Payables (AP)</span>
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-rose-500 font-mono">৳{totalPayables.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Outstanding perfume supplier invoices
          </div>
        </div>

        {/* Net Working Capital */}
        <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Net Current Liquidity</span>
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
              <Landmark className="w-4 h-4" />
            </span>
          </div>
          <div className={`text-2xl font-bold font-mono ${netBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {netBalance >= 0 ? '+' : ''}৳{netBalance.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Receivables minus payables balance
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab('payables')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'payables'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          Accounts Payable ({payablesList.length})
        </button>

        <button
          onClick={() => setActiveTab('receivables')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'receivables'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          Accounts Receivable ({receivablesList.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'payables' ? (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">Supplier Invoices Due (AP)</h3>
              <p className="text-xs text-[var(--text-muted)]">Balances due to international fragrance importers and local suppliers</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[var(--text)]">
              <thead className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Origin</th>
                  <th className="py-3 px-4">Currency</th>
                  <th className="py-3 px-4 text-right">Outstanding Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {payablesList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">
                      All supplier accounts are fully settled. No outstanding payables.
                    </td>
                  </tr>
                ) : (
                  payablesList.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--accent)]/5 transition-colors">
                      <td className="py-3 px-4 font-medium text-[var(--text)]">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-rose-400" />
                          {p.supplier_name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">
                        <div>{p.contact_person}</div>
                        <div className="text-[10px] font-mono">{p.phone}</div>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">
                        {p.country}
                      </td>
                      <td className="py-3 px-4 font-mono uppercase text-[var(--text-muted)]">
                        {p.currency}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-500">
                        ৳{p.balance_due.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Payment Due
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">Courier COD Receivables (AR)</h3>
              <p className="text-xs text-[var(--text-muted)]">Delivered parcels awaiting COD disbursement payout from Steadfast</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[var(--text)]">
              <thead className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Courier / Consignment</th>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4 text-right">COD Collected</th>
                  <th className="py-3 px-4 text-right">Courier Fee</th>
                  <th className="py-3 px-4 text-right">Net Receivable</th>
                  <th className="py-3 px-4 text-center">Parcel Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {receivablesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                      No pending courier receivables awaiting payout.
                    </td>
                  </tr>
                ) : (
                  receivablesList.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--accent)]/5 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-[var(--accent)]">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-emerald-400" />
                          {r.entity}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                        {r.order_id}
                      </td>
                      <td className="py-3 px-4 text-[var(--text)] font-medium">
                        {r.recipient}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[var(--text-muted)]">
                        ৳{r.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[var(--text-muted)]">
                        ৳{r.courier_charge.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500">
                        ৳{r.net_receivable.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.status === 'delivered'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
