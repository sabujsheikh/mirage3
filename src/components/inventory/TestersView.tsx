import React, { useMemo, useState } from 'react';
import { Search, FlaskConical, History, X, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import { OFFICIAL_TESTERS, TesterItem } from '../../lib/testerTypes';
import { CustomerProfileModal } from '../orders/CustomerProfileModal';
import { getCustomerStats } from '../orders/orderHelpers';
import { Modal } from '../common/Modal';

interface TesterUsageRecord {
  id: string;
  date: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  testerId: string;
  testerName: string;
  quantity: number;
  order: Order;
}

export const TestersView: React.FC = () => {
  const { products, orders, customers } = useApp();
  const [activeTab, setActiveTab] = useState<'testers' | 'history'>('testers');
  const [search, setSearch] = useState('');
  const [selectedTester, setSelectedTester] = useState<TesterItem | null>(null);
  const [testerOverviewTab, setTesterOverviewTab] = useState<'overview' | 'history'>('overview');
  
  // Custom linked product map (informational only)
  const [linkedProducts, setLinkedProducts] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('mirage_tester_linked_products');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Default informational matches
    return {
      'tester-amber-oud-gold': products.find(p => p.display_name.toLowerCase().includes('amber oud') || p.display_name.toLowerCase().includes('gold'))?.id || '',
      'tester-laventure': products.find(p => p.display_name.toLowerCase().includes('aventure'))?.id || '',
      'tester-marwa': products.find(p => p.display_name.toLowerCase().includes('marwa'))?.id || '',
    };
  });

  const [customerRatings, setCustomerRatings] = useState<Record<string, number>>({});
  const [customerProfileData, setCustomerProfileData] = useState<{
    customerName: string;
    phone: string;
    address: string;
    rating: number;
    notes: string;
    stats: any;
    orders: Order[];
  } | null>(null);

  // Match order tester item to one of the 3 official testers
  const matchTesterId = (productId: string, productName: string): string => {
    if (productId === 'tester-amber-oud-gold' || productId === 'tester-laventure' || productId === 'tester-marwa') {
      return productId;
    }
    const lower = (productName || '').toLowerCase();
    if (lower.includes('amber oud') || lower.includes('gold edition')) return 'tester-amber-oud-gold';
    if (lower.includes('aventure') || lower.includes("l'aventure")) return 'tester-laventure';
    if (lower.includes('marwa')) return 'tester-marwa';
    // Default fallback to first if matched
    return 'tester-amber-oud-gold';
  };

  // Build tester usage records from real orders
  const { historyList, testerStatsMap } = useMemo(() => {
    const history: TesterUsageRecord[] = [];
    const counts: Record<string, number> = {
      'tester-amber-oud-gold': 0,
      'tester-laventure': 0,
      'tester-marwa': 0,
    };

    orders.forEach((ord) => {
      if (ord.testers && Array.isArray(ord.testers)) {
        ord.testers.forEach((t, idx) => {
          const matchedId = matchTesterId(t.product_id, t.product_name);
          const qty = t.quantity || 1;
          counts[matchedId] = (counts[matchedId] || 0) + qty;

          const official = OFFICIAL_TESTERS.find(o => o.id === matchedId);
          history.push({
            id: `${ord.id}-${t.id || idx}`,
            date: ord.created_at,
            orderNumber: ord.invoice_number || ord.id,
            customerName: ord.customer_name,
            customerPhone: ord.customer_phone,
            testerId: matchedId,
            testerName: official ? official.name : t.product_name,
            quantity: qty,
            order: ord,
          });
        });
      }
    });

    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { historyList: history, testerStatsMap: counts };
  }, [orders]);

  // Compiled 3 tester items with live availability
  const compiledTesters = useMemo(() => {
    return OFFICIAL_TESTERS.map(t => {
      const givenOut = testerStatsMap[t.id] || 0;
      const available = Math.max(0, t.initialStock - givenOut);
      const linkedProdId = linkedProducts[t.id];
      const linkedProduct = products.find(p => p.id === linkedProdId);

      return {
        ...t,
        givenOut,
        available,
        linkedProduct,
      };
    });
  }, [testerStatsMap, linkedProducts, products]);

  // Filtered lists for active tab
  const filteredTesters = useMemo(() => {
    if (!search.trim()) return compiledTesters;
    const q = search.toLowerCase();
    return compiledTesters.filter(t => 
      t.name.toLowerCase().includes(q) || 
      t.sku.toLowerCase().includes(q) ||
      (t.linkedProduct?.display_name || '').toLowerCase().includes(q)
    );
  }, [compiledTesters, search]);

  const filteredHistory = useMemo(() => {
    if (!search.trim()) return historyList;
    const q = search.toLowerCase();
    return historyList.filter(
      h =>
        h.customerName.toLowerCase().includes(q) ||
        h.testerName.toLowerCase().includes(q) ||
        h.orderNumber.toLowerCase().includes(q) ||
        h.customerPhone.includes(q)
    );
  }, [historyList, search]);

  const handleOpenCustomerProfile = (order: Order) => {
    const stats = getCustomerStats(order.customer_phone, order.id, customers, orders, customerRatings);
    const normalizedPhone = order.customer_phone.replace(/[^0-9]/g, '');

    setCustomerProfileData({
      customerName: order.customer_name,
      phone: order.customer_phone,
      address: order.delivery_address_text || 'Showroom In-Store Handoff',
      rating: customerRatings[normalizedPhone] || stats.currentRating || 5,
      notes:
        order.notes ||
        (stats.isRisk
          ? 'Requires advance verification before dispatch.'
          : 'Customer purchase profile record.'),
      stats,
      orders: stats.allOrders && stats.allOrders.length > 0 ? stats.allOrders : [order],
    });
  };

  const handleLinkProduct = (testerId: string, productId: string) => {
    const updated = { ...linkedProducts, [testerId]: productId };
    setLinkedProducts(updated);
    try {
      localStorage.setItem('mirage_tester_linked_products', JSON.stringify(updated));
    } catch {}
  };

  const activeModalTester = useMemo(() => {
    if (!selectedTester) return null;
    return compiledTesters.find(t => t.id === selectedTester.id) || null;
  }, [selectedTester, compiledTesters]);

  const activeTesterHistory = useMemo(() => {
    if (!selectedTester) return [];
    return historyList.filter(h => h.testerId === selectedTester.id);
  }, [selectedTester, historyList]);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--text)]">Testers</h2>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('testers')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === 'testers'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Testers ({OFFICIAL_TESTERS.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === 'history'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({historyList.length})</span>
          </button>
        </div>

        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'testers' ? 'Search testers...' : 'Search history...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {/* TAB 1: Testers Table */}
      {activeTab === 'testers' && (
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)] shadow-2xs">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th className="text-left py-2.5 px-3">Tester Name</th>
                <th className="text-right py-2.5 px-3 w-32">Available</th>
                <th className="text-right py-2.5 px-3 w-32">Given Out</th>
                <th className="text-left py-2.5 px-3 w-44">Last Stock Received Date</th>
                <th className="text-right py-2.5 px-3 w-48">Last Stock Received Quantity</th>
              </tr>
            </thead>
            <tbody>
              {filteredTesters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                    No testers found
                  </td>
                </tr>
              ) : (
                filteredTesters.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => {
                      setSelectedTester(t);
                      setTesterOverviewTab('overview');
                    }}
                    className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-[var(--text)] text-xs">{t.name}</div>
                      {t.linkedProduct && (
                        <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                          Linked Perfume: {t.linkedProduct.display_name}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num font-bold text-xs text-[var(--text)]">
                      {t.available}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num font-semibold text-xs text-[var(--text)]">
                      {t.givenOut}
                    </td>
                    <td className="py-2.5 px-3 text-left font-num text-xs text-[var(--text-secondary)]">
                      {new Date(t.lastStockReceivedDate).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num font-semibold text-xs text-[var(--text)]">
                      {t.lastStockReceivedQty}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: General History Table */}
      {activeTab === 'history' && (
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)] shadow-2xs">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th className="text-left py-2.5 px-3 w-32">Date</th>
                <th className="text-left py-2.5 px-3 w-40">Order Number</th>
                <th className="text-left py-2.5 px-3">Customer Name</th>
                <th className="text-left py-2.5 px-3">Tester Name</th>
                <th className="text-right py-2.5 px-3 w-36">Quantity Given</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                    No history found
                  </td>
                </tr>
              ) : (
                filteredHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="py-2 px-3 text-xs text-[var(--text-secondary)] font-num">
                      {new Date(h.date).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-2 px-3 font-num font-bold text-xs text-[var(--text)]">
                      {h.orderNumber}
                    </td>
                    <td className="py-2 px-3 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => handleOpenCustomerProfile(h.order)}
                        className="text-[var(--accent)] hover:underline cursor-pointer text-left"
                      >
                        {h.customerName}
                      </button>
                    </td>
                    <td className="py-2 px-3 text-xs text-[var(--text)] font-medium">
                      {h.testerName}
                    </td>
                    <td className="py-2 px-3 text-right font-num font-semibold text-xs text-[var(--text)]">
                      {h.quantity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tester Overview / Details Modal */}
      {activeModalTester && (
        <Modal
          open={!!activeModalTester}
          onClose={() => setSelectedTester(null)}
          title={activeModalTester.name}
          size="lg"
        >
          <div className="p-4 space-y-4">
            {/* Modal Tabs */}
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-0.5">
              <button
                type="button"
                onClick={() => setTesterOverviewTab('overview')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  testerOverviewTab === 'overview'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setTesterOverviewTab('history')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  testerOverviewTab === 'history'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                History ({activeTesterHistory.length})
              </button>
            </div>

            {/* TAB: Overview */}
            {testerOverviewTab === 'overview' && (
              <div className="space-y-4">
                {/* 4 Key Inventory Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
                    <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Available</div>
                    <div className="text-lg font-bold font-num text-[var(--text)] mt-1">
                      {activeModalTester.available}
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
                    <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Given Out</div>
                    <div className="text-lg font-bold font-num text-[var(--text)] mt-1">
                      {activeModalTester.givenOut}
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
                    <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Last Stock Received Date</div>
                    <div className="text-xs font-bold font-num text-[var(--text)] mt-2">
                      {new Date(activeModalTester.lastStockReceivedDate).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
                    <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Last Received Qty</div>
                    <div className="text-lg font-bold font-num text-[var(--text)] mt-1">
                      {activeModalTester.lastStockReceivedQty}
                    </div>
                  </div>
                </div>

                {/* Linked Perfume / Product (Informational Only) */}
                <div className="p-3.5 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Linked Perfume (Informational)</span>
                    </label>
                  </div>
                  <select
                    value={linkedProducts[activeModalTester.id] || ''}
                    onChange={(e) => handleLinkProduct(activeModalTester.id, e.target.value)}
                    className="w-full p-2 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                  >
                    <option value="">-- No perfume linked --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} {p.sku ? `(${p.sku})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* TAB: History */}
            {testerOverviewTab === 'history' && (
              <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
                <table className="dense-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-2.5 w-28">Date</th>
                      <th className="text-left py-2 px-2.5 w-36">Order Number</th>
                      <th className="text-left py-2 px-2.5">Customer Name</th>
                      <th className="text-left py-2 px-2.5">Tester Name</th>
                      <th className="text-right py-2 px-2.5 w-28">Quantity Given</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTesterHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-xs text-[var(--text-secondary)]">
                          No history for this tester
                        </td>
                      </tr>
                    ) : (
                      activeTesterHistory.map((h) => (
                        <tr key={h.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                          <td className="py-2 px-2.5 text-xs text-[var(--text-secondary)] font-num">
                            {new Date(h.date).toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="py-2 px-2.5 font-num font-bold text-xs text-[var(--text)]">
                            {h.orderNumber}
                          </td>
                          <td className="py-2 px-2.5 text-xs font-semibold">
                            <button
                              type="button"
                              onClick={() => handleOpenCustomerProfile(h.order)}
                              className="text-[var(--accent)] hover:underline cursor-pointer text-left"
                            >
                              {h.customerName}
                            </button>
                          </td>
                          <td className="py-2 px-2.5 text-xs text-[var(--text)] font-medium">
                            {h.testerName}
                          </td>
                          <td className="py-2 px-2.5 text-right font-num font-semibold text-xs text-[var(--text)]">
                            {h.quantity}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedTester(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] text-[var(--text)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Customer Profile Modal */}
      {customerProfileData && (
        <CustomerProfileModal
          data={customerProfileData}
          onClose={() => setCustomerProfileData(null)}
          onUpdateRating={(rating) => {
            const phone = customerProfileData.phone.replace(/[^0-9]/g, '');
            setCustomerRatings((prev) => ({ ...prev, [phone]: rating }));
            setCustomerProfileData((prev) => (prev ? { ...prev, rating } : null));
          }}
        />
      )}
    </div>
  );
};
