import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../common/PageHeader';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Customer, Customer360Data, Order } from '../../types';
import { Star, ArrowLeft, RefreshCw, Building2, Phone, MapPin, Package, ShoppingBag, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const CustomerProfileView: React.FC = () => {
  const { activePath, setActivePath, orders: allOrders } = useApp();
  const { sessionToken, currentUser } = useAuth();

  const customerId = React.useMemo(() => {
    const match = activePath.match(/customer_id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }, [activePath]);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customer360, setCustomer360] = useState<Customer360Data | null>(null);
  const [topProducts, setTopProducts] = useState<Array<{ product_id: string; sku: string; product_name: string; units_bought: number; net_value: number }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<boolean>(false);
  const [savingRating, setSavingRating] = useState<boolean>(false);

  const fetchCustomerData = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const [custRes, c360Res, histRes] = await Promise.all([
        fetch(`/api/customers/${customerId}`, { headers }),
        fetch(`/api/crm/customers/${customerId}/360`, { headers }).catch(() => null),
        fetch(`/api/customers/${customerId}/item-history?view=products&page_size=5`, { headers }).catch(() => null),
      ]);

      if (!custRes.ok) throw new Error('Customer not found');
      const custData = await custRes.json();
      setCustomer(custData);

      if (c360Res && c360Res.ok) {
        const c360Data = await c360Res.json();
        setCustomer360(c360Data);
      }

      if (histRes && histRes.ok) {
        const histData = await histRes.json();
        setTopProducts(histData.products || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading customer profile');
    } finally {
      setLoading(false);
    }
  }, [customerId, sessionToken]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  const handleUpdateType = async (newType: string, newBusName?: string) => {
    if (!customer) return;
    setSavingType(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
      if (currentUser?.id) headers['x-authenticated-user-id'] = currentUser.id;

      const res = await fetch(`/api/customers/${customer.id}/type`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          customer_type: newType === 'auto' ? null : newType,
          business_name: newBusName !== undefined ? newBusName : customer.business_name,
          actor_id: currentUser?.id,
          actor_name: currentUser?.name,
        }),
      });
      if (!res.ok) throw new Error('Failed to update customer type');
      const updated = await res.json();
      setCustomer(updated);
      fetchCustomerData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingType(false);
    }
  };

  const handleUpdateRating = async (newRating: number) => {
    if (!customer) return;
    setSavingRating(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
      if (currentUser?.id) headers['x-authenticated-user-id'] = currentUser.id;

      const res = await fetch(`/api/customers/${customer.id}/rating`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          rating: newRating,
          actor_id: currentUser?.id,
          actor_name: currentUser?.name,
        }),
      });
      if (!res.ok) throw new Error('Failed to update rating');
      const updated = await res.json();
      setCustomer(updated);
      fetchCustomerData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingRating(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-xs text-[var(--text-muted)] font-mono">Loading customer profile...</div>;
  }

  if (error || !customer) {
    return (
      <div className="p-8 space-y-4 max-w-7xl mx-auto">
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded text-xs font-semibold">
          {error || 'Customer not found'}
        </div>
        <button
          onClick={() => setActivePath('/customers')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-xs font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Customers
        </button>
      </div>
    );
  }

  // Determine effective type
  const custOrders = customer360?.orders || allOrders.filter(o => o.customer_id === customer.id || o.customer_phone.replace(/\D/g, '') === customer.phone.replace(/\D/g, ''));
  const nonCancelledOrders = custOrders.filter(o => o.status !== 'cancelled');
  const wholesaleCount = nonCancelledOrders.filter(o => o.sale_type === 'wholesale').length;
  const computedType = nonCancelledOrders.length > 0 && (wholesaleCount / nonCancelledOrders.length >= 0.5) ? 'wholesale' : 'retail';
  const effectiveType = customer.customer_type || computedType;

  // Stats
  const deliveredOrders = nonCancelledOrders.filter(o => o.status === 'delivered').length;
  const rtoOrders = custOrders.filter(o => o.status === 'returned').length;
  const totalSpent = nonCancelledOrders.reduce((s, o) => s + o.total, 0);
  const totalUnits = nonCancelledOrders.reduce((s, o) => s + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);
  const avgOrderValue = nonCancelledOrders.length > 0 ? Math.round(totalSpent / nonCancelledOrders.length) : 0;
  const totalOutstandingDue = nonCancelledOrders.reduce((s, o) => {
    const paid = (o.payments || []).filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
    return s + Math.max(0, o.total - paid);
  }, 0);

  const lastOrder = nonCancelledOrders.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const daysSinceLastOrder = lastOrder ? Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24)) : '-';

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto pb-8">
      <PageHeader
        eyebrow="Customer profile"
        title={customer.name}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePath(`/customers/item-history?customer_id=${encodeURIComponent(customer.id)}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer shadow-xs"
            >
              Item history
            </button>
            <button
              onClick={() => setActivePath('/customers')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Directory
            </button>
            <button
              onClick={fetchCustomerData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Header Info Strip & Type/Rating Controls */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-md px-3 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Phone:</span>{' '}
            <span className="font-bold text-[var(--text)]">{customer.phone}</span>
          </div>
          {customer.business_name && (
            <div>
              <span className="text-[var(--text-muted)] text-[11px] font-sans">Business:</span>{' '}
              <span className="font-bold text-[var(--text)]">{customer.business_name}</span>
            </div>
          )}
          <div>
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Type:</span>{' '}
            <span className="font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--accent)]">
              {effectiveType}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Star Rating */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-[var(--text-muted)] font-sans">Rating:</span>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => handleUpdateRating(n)}
                disabled={savingRating}
                className="cursor-pointer"
              >
                <Star className={`w-4 h-4 ${n <= Math.round(customer.rating || 3) ? 'fill-[var(--accent-secondary)] text-[var(--accent-secondary)]' : 'text-[var(--border)]'}`} />
              </button>
            ))}
          </div>

          {/* Type Control */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-[var(--text-muted)] font-sans">Profile Type:</span>
            <select
              value={customer.customer_type || 'auto'}
              onChange={(e) => handleUpdateType(e.target.value)}
              disabled={savingType}
              className="bg-[var(--surface-sunken)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] cursor-pointer"
            >
              <option value="auto">Auto ({computedType})</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Strip */}
      {effectiveType === 'retail' ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-md px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Lifetime Spend:</span>
            <span className="font-bold text-[var(--text)]">৳{totalSpent.toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Orders:</span>
            <span className="font-bold text-[var(--text)]">{nonCancelledOrders.length}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">AOV:</span>
            <span className="font-bold text-[var(--text)]">৳{avgOrderValue.toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Last Order:</span>
            <span className="font-bold text-[var(--text)]">{daysSinceLastOrder} days ago</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Success Rate:</span>
            <span className="font-bold text-emerald-600">{nonCancelledOrders.length > 0 ? Math.round((deliveredOrders / nonCancelledOrders.length) * 100) : 0}%</span>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-md px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Total Purchased:</span>
            <span className="font-bold text-[var(--text)]">৳{totalSpent.toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Total Units:</span>
            <span className="font-bold text-[var(--text)]">{totalUnits}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Orders:</span>
            <span className="font-bold text-[var(--text)]">{nonCancelledOrders.length}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Outstanding Due:</span>
            <span className={`font-bold ${totalOutstandingDue > 0 ? 'text-[var(--negative)]' : 'text-[var(--text)]'}`}>৳{totalOutstandingDue.toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Last Order:</span>
            <span className="font-bold text-[var(--text)]">{daysSinceLastOrder} days ago</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {/* Orders Table */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden shadow-xs">
            <div className="px-3 py-2 bg-[var(--surface-sunken)] border-b border-[var(--border)] text-xs font-bold text-[var(--text)]">
              Orders History ({nonCancelledOrders.length})
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead className="sticky top-0 bg-[var(--surface-sunken)] text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border)]">
                  <tr>
                    <th className="py-2 px-3">Invoice</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Sale Type</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3 text-right">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {nonCancelledOrders.map(o => {
                    const paid = (o.payments || []).filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
                    const due = Math.max(0, o.total - paid);
                    return (
                      <tr
                        key={o.id}
                        onDoubleClick={() => setActivePath(`/orders?order_id=${o.id}`)}
                        className="hover:bg-[var(--surface-hover)] cursor-pointer"
                      >
                        <td className="py-2 px-3 font-bold text-[var(--accent)]">{o.invoice_number}</td>
                        <td className="py-2 px-3 text-[var(--text-muted)]">{o.created_at.slice(0, 10)}</td>
                        <td className="py-2 px-3 uppercase text-[10px]">{o.sale_type || 'retail'}</td>
                        <td className="py-2 px-3 capitalize">{o.status}</td>
                        <td className="py-2 px-3 text-right font-bold">৳{o.total.toLocaleString()}</td>
                        <td className={`py-2 px-3 text-right font-bold ${due > 0 ? 'text-[var(--negative)]' : 'text-[var(--text)]'}`}>৳{due.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Wholesale Products Purchased vs Retail Preferences */}
          {effectiveType === 'wholesale' ? (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-[var(--text)]">Products purchased</div>
                <button
                  onClick={() => setActivePath(`/customers/item-history?customer_id=${encodeURIComponent(customer.id)}&view=products`)}
                  className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
                >
                  View all
                </button>
              </div>
              <div className="text-xs text-[var(--text-muted)] font-mono">
                {topProducts.length === 0 ? (
                  <div>No purchase history yet.</div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border)]">
                        <th className="py-1.5 px-2">SKU / Product</th>
                        <th className="py-1.5 px-2 text-right">Units</th>
                        <th className="py-1.5 px-2 text-right">Total Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] font-mono">
                      {topProducts.slice(0, 5).map((si, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-2">[{si.sku}] {si.product_name}</td>
                          <td className="py-1.5 px-2 text-right font-bold">{si.units_bought}</td>
                          <td className="py-1.5 px-2 text-right font-bold">৳{si.net_value.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 space-y-2">
              <div className="text-xs font-bold text-[var(--text)]">Fragrance preferences & special dates</div>
              <div className="text-xs text-[var(--text-muted)] space-y-1">
                <div>Preferred category: {customer360?.preferences?.preferred_category || 'Not specified'}</div>
                <div>Price sensitivity: {customer360?.preferences?.price_sensitivity || 'Moderate'}</div>
                <div>Special dates: {customer360?.special_dates?.length ? customer360.special_dates.map(d => `${d.label} (${d.date})`).join(', ') : 'None registered'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Side Column */}
        <div className="space-y-3">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 space-y-2">
            <div className="text-xs font-bold text-[var(--text)]">Addresses</div>
            <div className="space-y-1 text-xs font-mono">
              {customer.addresses?.map((addr, i) => (
                <div key={addr.id || i} className="p-2 rounded bg-[var(--surface-sunken)] border border-[var(--border)]">
                  {addr.address_text}
                </div>
              )) || 'No address on file'}
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 space-y-2">
            <div className="text-xs font-bold text-[var(--text)]">Tags</div>
            <div className="flex flex-wrap gap-1">
              {customer360?.tags?.map(t => (
                <span key={t.id} className="px-2 py-0.5 rounded text-[10px] font-bold border" style={{ color: t.color, borderColor: t.color }}>
                  {t.name}
                </span>
              )) || <span className="text-xs text-[var(--text-muted)]">No tags</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
