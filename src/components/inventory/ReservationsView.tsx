import React, { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ReservationEvent } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const ReservationsView: React.FC = () => {
  const { products } = useApp();
  const { can } = useAuth();
  const [events, setEvents] = useState<ReservationEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    let active = true;
    fetch('/api/inventory/reservations')
      .then(r => r.json())
      .then(data => {
        if (active) setEvents(data || []);
      })
      .catch(() => {
        if (active) setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const productName = (id: string) => {
    const p = products.find(x => x.id === id);
    return p?.display_name || 'Unknown Product';
  };

  const productSku = (id: string) => {
    const p = products.find(x => x.id === id);
    return p?.sku || '\u2014';
  };

  const filtered = events.filter(e => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = productName(e.product_id).toLowerCase();
      const sku = productSku(e.product_id).toLowerCase();
      const notes = (e.notes || '').toLowerCase();
      const oid = String(e.order_id).toLowerCase();
      if (!name.includes(q) && !sku.includes(q) && !notes.includes(q) && !oid.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search reservations by SKU, product, order, or note..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-[var(--border)] rounded-md focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-[var(--border)] rounded-md bg-[var(--card)] text-[var(--text)]"
          >
            <option value="all">All Reservation Events</option>
            <option value="RESERVE">RESERVE</option>
            <option value="RELEASE">RELEASE</option>
          </select>
        </div>
        <div className="text-[11px] text-[var(--text-secondary)]">
          Section 32.4/41 &#8212; reservation ledger is separate from the physical stock-movement ledger.
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-[var(--text-secondary)] text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading reservations...
          </div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Product</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 text-center">Qty</th>
                <th className="px-4 py-2.5">Order</th>
                <th className="px-4 py-2.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-secondary)] text-xs">
                    No reservation events recorded matching filters.
                  </td>
                </tr>
              ) : (
                filtered.map(e => {
                  const isReserve = e.type === 'RESERVE';
                  return (
                    <tr key={e.id} className="hover:bg-[var(--surface-sunken)]">
                      <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-secondary)]">
                        {new Date(e.created_at).toLocaleString('en-GB')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[var(--text)]">{productName(e.product_id)}</div>
                        <div className="font-mono text-[11px] text-[var(--accent)] font-semibold">
                          SKU: {productSku(e.product_id)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${
                            isReserve
                              ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20'
                              : 'bg-[var(--status-green)]/10 text-[var(--status-green)] border-[var(--status-green)]/20'
                          }`}
                        >
                          {e.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded ${
                            isReserve ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[var(--status-green)] bg-[var(--status-green)]/10'
                          }`}
                        >
                          {isReserve ? '+' : '\u2212'}
                          {e.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[var(--accent)] font-semibold">
                        {String(e.order_id).slice(0, 14)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] text-[11px] max-w-sm">
                        <div>{e.notes || '\u2014'}</div>
                        <div className="text-[10px] text-[var(--text-secondary)]/80 mt-0.5">
                          By: {e.created_by_name}
                          {can('view_audit_log') ? ` (${e.created_by})` : ''}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
