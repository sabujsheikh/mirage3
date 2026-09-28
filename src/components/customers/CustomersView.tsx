import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../common/PageHeader';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Customer, Order } from '../../types';
import { Search, Star, ChevronLeft, ChevronRight, RefreshCw, Filter, ArrowUpDown } from 'lucide-react';

export const CustomersView: React.FC = () => {
  const { setActivePath, orders: allOrders } = useApp();
  const { sessionToken } = useAuth();

  const [activeTypeTab, setActiveTypeTab] = useState<'all' | 'retail' | 'wholesale'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('page_size', String(pageSize));
      if (activeTypeTab !== 'all') params.set('type', activeTypeTab);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (cityFilter !== 'all') params.set('city', cityFilter);
      if (ratingFilter !== 'all') params.set('rating', ratingFilter);

      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`/api/customers?${params.toString()}`, { headers });
      if (!res.ok) throw new Error('Failed to load customers');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCustomers(data);
      } else {
        setCustomers(data.items || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading customers');
    } finally {
      setLoading(false);
    }
  }, [activeTypeTab, searchQuery, cityFilter, ratingFilter, currentPage, pageSize, sessionToken]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Compute helper stats per customer using allOrders
  const getCustMetrics = (c: Customer) => {
    const custOrders = allOrders.filter(
      o => o.customer_id === c.id || (o.customer_phone && c.phone && o.customer_phone.replace(/\D/g, '') === c.phone.replace(/\D/g, ''))
    );
    const nonCancelled = custOrders.filter(o => o.status !== 'cancelled');
    const delivered = nonCancelled.filter(o => o.status === 'delivered').length;
    const totalSpent = nonCancelled.reduce((s, o) => s + o.total, 0);
    const totalUnits = nonCancelled.reduce((s, o) => s + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);
    const successRate = nonCancelled.length > 0 ? Math.round((delivered / nonCancelled.length) * 100) : 0;
    const outstandingDue = nonCancelled.reduce((s, o) => {
      const paid = (o.payments || []).filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
      return s + Math.max(0, o.total - paid);
    }, 0);

    const wholesaleCount = nonCancelled.filter(o => o.sale_type === 'wholesale').length;
    const computedType = nonCancelled.length > 0 && (wholesaleCount / nonCancelled.length >= 0.5) ? 'wholesale' : 'retail';
    const effType = c.customer_type || computedType;

    const lastOrder = nonCancelled.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const daysSinceLast = lastOrder ? Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24)) : '-';

    // Reorder status for wholesale
    let reorderStatus = '-';
    if (nonCancelled.length >= 3) {
      const sorted = [...nonCancelled].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      let diff = 0;
      for (let i = 0; i < sorted.length - 1; i++) {
        diff += Math.max(0, (new Date(sorted[i+1].created_at).getTime() - new Date(sorted[i].created_at).getTime()) / (1000 * 60 * 60 * 24));
      }
      const avgInterval = diff / (sorted.length - 1);
      if (avgInterval > 0) {
        const daysLast = typeof daysSinceLast === 'number' ? daysSinceLast : 0;
        if (daysLast <= avgInterval) reorderStatus = 'On cycle';
        else if (daysLast <= 1.5 * avgInterval) reorderStatus = 'Due';
        else reorderStatus = 'Overdue';
      }
    }

    return {
      custOrders,
      nonCancelled,
      delivered,
      totalSpent,
      totalUnits,
      successRate,
      outstandingDue,
      effType,
      lastOrderDate: lastOrder ? lastOrder.created_at.slice(0, 10) : '-',
      daysSinceLast,
      reorderStatus,
    };
  };

  // Filtered list client-side if needed or server side
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const metrics = getCustMetrics(c);
      if (activeTypeTab !== 'all' && metrics.effType !== activeTypeTab) return false;
      if (cityFilter !== 'all' && c.city !== cityFilter) return false;
      if (ratingFilter !== 'all' && Math.round(c.rating || 3) !== Number(ratingFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = [c.name, c.phone, c.business_name, c.city, ...(c.addresses || []).map(a => a.address_text)].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [customers, activeTypeTab, searchQuery, cityFilter, ratingFilter, allOrders]);

  // Data strip summaries per view
  const retailCustomersList = customers.filter(c => getCustMetrics(c).effType === 'retail');
  const wholesaleCustomersList = customers.filter(c => getCustMetrics(c).effType === 'wholesale');

  const retailReturningPct = retailCustomersList.length > 0
    ? Math.round((retailCustomersList.filter(c => getCustMetrics(c).nonCancelled.length >= 2).length / retailCustomersList.length) * 100)
    : 0;
  const retailAvgSpend = retailCustomersList.length > 0
    ? Math.round(retailCustomersList.reduce((s, c) => s + getCustMetrics(c).totalSpent, 0) / retailCustomersList.length)
    : 0;

  const wholesaleTotalPurchased = wholesaleCustomersList.reduce((s, c) => s + getCustMetrics(c).totalSpent, 0);
  const wholesaleTotalUnits = wholesaleCustomersList.reduce((s, c) => s + getCustMetrics(c).totalUnits, 0);
  const wholesaleTotalDue = wholesaleCustomersList.reduce((s, c) => s + getCustMetrics(c).outstandingDue, 0);
  const wholesaleReorderDueCount = wholesaleCustomersList.filter(c => {
    const st = getCustMetrics(c).reorderStatus;
    return st === 'Due' || st === 'Overdue';
  }).length;

  const allTotalDue = customers.reduce((s, c) => s + getCustMetrics(c).outstandingDue, 0);

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto pb-8">
      <PageHeader
        eyebrow="Contacts"
        title="Customers"
        actions={
          <button
            onClick={fetchCustomers}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Segmented Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--card)] border border-[var(--border)] rounded-lg p-2 shadow-xs">
        <div className="flex items-center gap-1 bg-[var(--surface-sunken)] p-1 rounded-md">
          {(['all', 'retail', 'wholesale'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTypeTab(tab);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer capitalize ${
                activeTypeTab === tab
                  ? 'bg-[var(--card)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search & Quick Filters */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search name, phone, business..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Data Strip (reflects current type selection) */}
      {activeTypeTab === 'retail' && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-md px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Retail Customers:</span>
            <span className="font-bold text-[var(--text)]">{retailCustomersList.length}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Returning Rate:</span>
            <span className="font-bold text-[var(--text)]">{retailReturningPct}%</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Average Lifetime Spend:</span>
            <span className="font-bold text-[var(--text)]">৳{retailAvgSpend.toLocaleString()}</span>
          </div>
        </div>
      )}

      {activeTypeTab === 'wholesale' && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-md px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Wholesale Customers:</span>
            <span className="font-bold text-[var(--text)]">{wholesaleCustomersList.length}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Total Purchased:</span>
            <span className="font-bold text-[var(--text)]">৳{wholesaleTotalPurchased.toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Total Units:</span>
            <span className="font-bold text-[var(--text)]">{wholesaleTotalUnits}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Total Outstanding Due:</span>
            <span className="font-bold text-[var(--negative)]">৳{wholesaleTotalDue.toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Reorder Due Count:</span>
            <span className="font-bold text-[var(--accent-secondary)]">{wholesaleReorderDueCount}</span>
          </div>
        </div>
      )}

      {activeTypeTab === 'all' && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-md px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Retail Customers:</span>
            <span className="font-bold text-[var(--text)]">{retailCustomersList.length}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Wholesale Customers:</span>
            <span className="font-bold text-[var(--text)]">{wholesaleCustomersList.length}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Avg Retail Spend:</span>
            <span className="font-bold text-[var(--text)]">৳{retailAvgSpend.toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[11px] font-sans">Total Outstanding Due:</span>
            <span className="font-bold text-[var(--negative)]">৳{allTotalDue.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-260px)] relative">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="sticky top-0 z-20 bg-[var(--surface-sunken)] shadow-xs">
              <tr className="border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <th className="sticky left-0 z-30 bg-[var(--surface-sunken)] py-3 px-3 whitespace-nowrap border-r border-[var(--border)]">
                  Customer
                </th>
                {activeTypeTab === 'all' && <th className="py-3 px-3 whitespace-nowrap">Type</th>}
                <th className="py-3 px-3 whitespace-nowrap">Phone</th>
                <th className="py-3 px-3 whitespace-nowrap">City</th>
                {activeTypeTab === 'retail' && <th className="py-3 px-3 whitespace-nowrap">Orders</th>}
                {activeTypeTab === 'retail' && <th className="py-3 px-3 whitespace-nowrap">Success Rate</th>}
                {activeTypeTab === 'wholesale' && <th className="py-3 px-3 whitespace-nowrap">Reorder Status</th>}
                {activeTypeTab === 'wholesale' && <th className="py-3 px-3 text-right whitespace-nowrap">Units</th>}
                {activeTypeTab === 'wholesale' && <th className="py-3 px-3 text-right whitespace-nowrap">Outstanding Due</th>}
                {activeTypeTab === 'all' && <th className="py-3 px-3 whitespace-nowrap">Status</th>}
                <th className="py-3 px-3 whitespace-nowrap">Rating</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Total Spent / Purchased</th>
                <th className="py-3 px-3 whitespace-nowrap">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-[var(--text-muted)]">No customers found.</td>
                </tr>
              ) : (
                filteredCustomers.map(c => {
                  const m = getCustMetrics(c);
                  return (
                    <tr
                      key={c.id}
                      onDoubleClick={() => setActivePath(`/customers/profile?customer_id=${c.id}`)}
                      className="hover:bg-[var(--surface-hover)] cursor-pointer odd:bg-[var(--card)] even:bg-[var(--surface-sunken)]/50"
                    >
                      <td className="sticky left-0 z-10 bg-[var(--card)] py-2.5 px-3 font-bold text-[var(--accent)] whitespace-nowrap border-r border-[var(--border)]">
                        <div>{c.name}</div>
                        {c.business_name && <div className="text-[10px] text-[var(--text-muted)] font-sans">{c.business_name}</div>}
                      </td>
                      {activeTypeTab === 'all' && (
                        <td className="py-2.5 px-3 uppercase text-[10px] whitespace-nowrap font-bold text-[var(--text-secondary)]">
                          {m.effType}
                        </td>
                      )}
                      <td className="py-2.5 px-3 whitespace-nowrap">{c.phone}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{c.city || 'Dhaka'}</td>
                      {activeTypeTab === 'retail' && <td className="py-2.5 px-3 whitespace-nowrap">{m.nonCancelled.length}</td>}
                      {activeTypeTab === 'retail' && <td className="py-2.5 px-3 whitespace-nowrap font-bold text-emerald-600">{m.successRate}%</td>}
                      {activeTypeTab === 'wholesale' && (
                        <td className="py-2.5 px-3 whitespace-nowrap font-bold" style={{ color: m.reorderStatus === 'Overdue' ? 'var(--negative)' : m.reorderStatus === 'Due' ? 'var(--accent-secondary)' : 'inherit' }}>
                          {m.reorderStatus}
                        </td>
                      )}
                      {activeTypeTab === 'wholesale' && <td className="py-2.5 px-3 text-right whitespace-nowrap">{m.totalUnits}</td>}
                      {activeTypeTab === 'wholesale' && (
                        <td className={`py-2.5 px-3 text-right whitespace-nowrap font-bold ${m.outstandingDue > 0 ? 'text-[var(--negative)]' : ''}`}>
                          ৳{m.outstandingDue.toLocaleString()}
                        </td>
                      )}
                      {activeTypeTab === 'all' && (
                        <td className="py-2.5 px-3 whitespace-nowrap uppercase text-[10px]">
                          {m.effType === 'wholesale' ? m.reorderStatus : 'Active'}
                        </td>
                      )}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-[var(--accent-secondary)] text-[var(--accent-secondary)]" />
                          <span>{(c.rating || 4.5).toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold">
                        ৳{m.totalSpent.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-[var(--text-muted)]">
                        {m.lastOrderDate}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
