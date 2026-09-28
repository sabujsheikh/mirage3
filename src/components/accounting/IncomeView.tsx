import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Order, JournalEntry } from '../../types';
import {
  TrendingUp,
  Truck,
  ShoppingBag,
  Download,
  Search,
  Store,
  Globe,
  RefreshCw,
} from 'lucide-react';

export const IncomeView: React.FC = () => {
  const { sessionToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [channelFilter, setChannelFilter] = useState<'all' | 'online' | 'walk_in'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('mirage_session_token') : null);
      const headers = token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {};
      const res = await fetch('/api/orders', { headers });
      if (res.ok) {
        const ordersData = await res.json();
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      }
    } catch (err) {
      console.error('Error fetching income data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sessionToken]);

  // Filter orders by time range and channel
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return (orders || []).filter((order) => {
      // Exclude cancelled
      if (order.status === 'cancelled') return false;

      // Channel filter ('messenger' = online, 'walk-in' = showroom)
      if (channelFilter === 'online' && order.channel !== 'messenger') return false;
      if (channelFilter === 'walk_in' && order.channel !== 'walk-in') return false;

      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchInvoice = order.invoice_number?.toLowerCase().includes(query);
        const matchCustomer = order.customer_name?.toLowerCase().includes(query);
        const matchPhone = order.customer_phone?.includes(query);
        if (!matchInvoice && !matchCustomer && !matchPhone) return false;
      }

      // Time filter
      const orderDate = new Date(order.created_at);
      if (timeFilter === 'today') {
        return order.created_at.startsWith(todayStr);
      }
      if (timeFilter === '7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return orderDate >= sevenDaysAgo;
      }
      if (timeFilter === 'month') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return orderDate >= thirtyDaysAgo;
      }
      return true;
    });
  }, [orders, timeFilter, channelFilter, searchQuery]);

  // Income summary metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let productSales = 0;
    let deliveryIncome = 0;
    let walkInRevenue = 0;
    let onlineRevenue = 0;

    const paymentMethods: Record<string, number> = {
      cash: 0,
      bkash: 0,
      nagad: 0,
      bank: 0,
      cod: 0,
    };

    filteredOrders.forEach((o) => {
      const net = o.total || 0;
      const delivery = o.delivery_charge || 0;
      const product = Math.max(0, net - delivery);

      totalRevenue += net;
      productSales += product;
      deliveryIncome += delivery;

      if (o.channel === 'walk-in') {
        walkInRevenue += net;
      } else {
        onlineRevenue += net;
      }

      const paymentMethod = o.payments?.[0]?.method || 'cod_pending';
      if (paymentMethod === 'bkash') paymentMethods.bkash += net;
      else if (paymentMethod === 'nagad') paymentMethods.nagad += net;
      else if (paymentMethod === 'bank') paymentMethods.bank += net;
      else if (paymentMethod === 'cash') paymentMethods.cash += net;
      else paymentMethods.cod += net;
    });

    const averageOrderValue = filteredOrders.length > 0 ? Math.round(totalRevenue / filteredOrders.length) : 0;

    return {
      totalRevenue,
      productSales,
      deliveryIncome,
      walkInRevenue,
      onlineRevenue,
      averageOrderValue,
      orderCount: filteredOrders.length,
      paymentMethods,
    };
  }, [filteredOrders]);

  const exportCSV = () => {
    const headers = ['Date', 'Invoice #', 'Channel', 'Customer', 'Phone', 'Product Total (BDT)', 'Delivery Charge (BDT)', 'Total Amount (BDT)', 'Payment Method', 'Status'];
    const rows = filteredOrders.map(o => [
      o.created_at.split('T')[0],
      o.invoice_number,
      o.channel,
      `"${o.customer_name}"`,
      o.customer_phone,
      Math.max(0, o.total - o.delivery_charge),
      o.delivery_charge,
      o.total,
      o.payments?.[0]?.method || 'cod_pending',
      o.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Mirage_Income_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">Income & Revenue Stream</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Live Audited
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Breakdown of revenue across walk-in showroom sales, online messenger fulfillment, and delivery fees.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchData}
            className="p-2 border border-[var(--border)] rounded-lg hover:bg-[var(--accent)]/10 text-[var(--text-muted)] hover:text-[var(--text)] transition-all cursor-pointer"
            title="Refresh revenue data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--accent)]/10 text-xs font-semibold rounded-lg text-[var(--text)] transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border)]">
        <div className="flex items-center gap-1 bg-[var(--bg)] p-1 rounded-lg border border-[var(--border)] text-xs">
          <button
            onClick={() => setTimeFilter('today')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              timeFilter === 'today' ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeFilter('7days')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              timeFilter === '7days' ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeFilter('month')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              timeFilter === 'month' ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              timeFilter === 'all' ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            All Time
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[var(--bg)] p-1 rounded-lg border border-[var(--border)] text-xs">
            <button
              onClick={() => setChannelFilter('all')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${
                channelFilter === 'all' ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              All Channels
            </button>
            <button
              onClick={() => setChannelFilter('walk_in')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${
                channelFilter === 'walk_in' ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Showroom
            </button>
            <button
              onClick={() => setChannelFilter('online')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${
                channelFilter === 'online' ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Online
            </button>
          </div>

          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice or customer..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Total Gross Revenue</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-[var(--text)] font-mono">৳{metrics.totalRevenue.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1 flex items-center justify-between">
            <span>{metrics.orderCount} fulfilled orders</span>
            <span className="text-emerald-500 font-medium">Avg ৳{metrics.averageOrderValue.toLocaleString()}/order</span>
          </div>
        </div>

        {/* Product Sales */}
        <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Perfume Sales</span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-[var(--text)] font-mono">৳{metrics.productSales.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Direct fragrance retail & wholesale
          </div>
        </div>

        {/* Delivery Income */}
        <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Delivery Fees Collected</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-[var(--text)] font-mono">৳{metrics.deliveryIncome.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Courier & hand delivery collections
          </div>
        </div>

        {/* Showroom vs Online */}
        <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Channel Mix</span>
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
              <Store className="w-4 h-4" />
            </span>
          </div>
          <div className="space-y-1.5 mt-2">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)] flex items-center gap-1">
                <Store className="w-3 h-3 text-purple-400" /> Showroom POS:
              </span>
              <span className="font-bold text-[var(--text)] font-mono">৳{metrics.walkInRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)] flex items-center gap-1">
                <Globe className="w-3 h-3 text-blue-400" /> Online Messenger:
              </span>
              <span className="font-bold text-[var(--text)] font-mono">৳{metrics.onlineRevenue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Transactions List */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Income & Sales Ledger</h3>
            <p className="text-xs text-[var(--text-muted)]">Real-time revenue transactions matching bank and cash entries</p>
          </div>
          <span className="text-xs text-[var(--text-muted)]">{filteredOrders.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--text)]">
            <thead className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Products</th>
                <th className="py-3 px-4 text-right">Delivery</th>
                <th className="py-3 px-4 text-right">Total Net</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[var(--text-muted)]">
                    No income records found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const productTotal = Math.max(0, order.total - order.delivery_charge);
                  const isWalkIn = order.channel === 'walk-in';
                  const method = order.payments?.[0]?.method || 'cod_pending';
                  return (
                    <tr key={order.id} className="hover:bg-[var(--accent)]/5 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-muted)]">
                        {order.created_at.replace('T', ' ').slice(0, 16)}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--accent)]">
                        {order.invoice_number}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          isWalkIn
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {isWalkIn ? <Store className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                          {isWalkIn ? 'Showroom' : 'Online'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[var(--text)]">{order.customer_name}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">{order.customer_phone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-mono text-[11px] text-[var(--text-muted)]">
                          {method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        ৳{productTotal.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[var(--text-muted)]">
                        ৳{order.delivery_charge.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500">
                        ৳{order.total.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          order.status === 'delivered'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : order.status === 'dispatched'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {order.status}
                        </span>
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
