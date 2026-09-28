import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Supplier } from '../../types';
import { Search, ChevronLeft, ChevronRight, RefreshCw, Plus } from 'lucide-react';
import { SupplierFormModal } from './SupplierFormModal';

const STORAGE_KEY = 'mirage_suppliers_directory_state';

interface DirectoryState {
  searchQuery: string;
  countryFilter: string;
  currencyFilter: string;
  statusFilter: 'all' | 'active' | 'inactive';
  balanceFilter: 'all' | 'with_balance';
  minPurchase: string;
  maxPurchase: string;
  pageSize: number;
  currentPage: number;
  selectedSupplierId: string | null;
}

export const SuppliersView: React.FC = () => {
  const { suppliers, purchaseOrders, setActivePath } = useApp();
  const { can } = useAuth();

  // Restore state from sessionStorage if present
  const savedState = useMemo<Partial<DirectoryState>>(() => {
    try {
      const item = sessionStorage.getItem(STORAGE_KEY);
      return item ? JSON.parse(item) : {};
    } catch {
      return {};
    }
  }, []);

  const [searchQuery, setSearchQuery] = useState<string>(savedState.searchQuery || '');
  const [countryFilter, setCountryFilter] = useState<string>(savedState.countryFilter || 'all');
  const [currencyFilter, setCurrencyFilter] = useState<string>(savedState.currencyFilter || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(savedState.statusFilter || 'all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'with_balance'>(savedState.balanceFilter || 'all');
  const [minPurchase, setMinPurchase] = useState<string>(savedState.minPurchase || '');
  const [maxPurchase, setMaxPurchase] = useState<string>(savedState.maxPurchase || '');
  const [pageSize, setPageSize] = useState<number>(savedState.pageSize || 25);
  const [currentPage, setCurrentPage] = useState<number>(savedState.currentPage || 1);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(savedState.selectedSupplierId || null);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Sync state to sessionStorage
  useEffect(() => {
    try {
      const stateToSave: DirectoryState = {
        searchQuery,
        countryFilter,
        currencyFilter,
        statusFilter,
        balanceFilter,
        minPurchase,
        maxPurchase,
        pageSize,
        currentPage,
        selectedSupplierId,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // ignore
    }
  }, [
    searchQuery,
    countryFilter,
    currencyFilter,
    statusFilter,
    balanceFilter,
    minPurchase,
    maxPurchase,
    pageSize,
    currentPage,
    selectedSupplierId,
  ]);

  // Unique countries from supplier list
  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach(s => {
      if (s.country && s.country.trim()) set.add(s.country.trim());
    });
    return Array.from(set).sort();
  }, [suppliers]);

  // Helper map for last purchase date and PO count from purchase orders
  const supplierPoStats = useMemo(() => {
    const stats: Record<string, { lastPurchaseDate: string; poCount: number; computedTotalPurchased: number }> = {};
    suppliers.forEach(s => {
      const pos = purchaseOrders.filter(p => p.supplier_id === s.id);
      const nonCancelled = pos.filter(p => p.status !== 'cancelled' && p.status !== 'draft');
      const sorted = [...pos].sort((a, b) => b.order_date.localeCompare(a.order_date));
      const lastPo = sorted[0];
      const sumPurchased = nonCancelled.reduce((acc, p) => acc + (p.total_amount_bdt || 0), 0);
      stats[s.id] = {
        lastPurchaseDate: lastPo ? lastPo.order_date : '-',
        poCount: pos.length,
        computedTotalPurchased: sumPurchased,
      };
    });
    return stats;
  }, [suppliers, purchaseOrders]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          (s.name || '').toLowerCase().includes(q) ||
          (s.contact_person || '').toLowerCase().includes(q) ||
          (s.phone || '').includes(q) ||
          (s.country || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Country
      if (countryFilter !== 'all') {
        if ((s.country || '').trim().toLowerCase() !== countryFilter.toLowerCase()) return false;
      }

      // Currency
      if (currencyFilter !== 'all') {
        if (s.currency !== currencyFilter) return false;
      }

      // Status
      if (statusFilter === 'active' && s.active === false) return false;
      if (statusFilter === 'inactive' && s.active !== false) return false;

      // Balance
      if (balanceFilter === 'with_balance' && !(s.balance_payable > 0)) return false;

      // Purchase total min & max
      const totalPurchased = s.total_purchases_amount_bdt ?? supplierPoStats[s.id]?.computedTotalPurchased ?? 0;
      if (minPurchase.trim() !== '') {
        const min = Number(minPurchase);
        if (!isNaN(min) && totalPurchased < min) return false;
      }
      if (maxPurchase.trim() !== '') {
        const max = Number(maxPurchase);
        if (!isNaN(max) && totalPurchased > max) return false;
      }

      return true;
    });
  }, [
    suppliers,
    searchQuery,
    countryFilter,
    currencyFilter,
    statusFilter,
    balanceFilter,
    minPurchase,
    maxPurchase,
    supplierPoStats,
  ]);

  // Overall data strip stats
  const activeSuppliersCount = useMemo(() => {
    return suppliers.filter(s => s.active !== false).length;
  }, [suppliers]);

  const totalPurchasedBdt = useMemo(() => {
    return suppliers.reduce((sum, s) => {
      const val = s.total_purchases_amount_bdt ?? supplierPoStats[s.id]?.computedTotalPurchased ?? 0;
      return sum + val;
    }, 0);
  }, [suppliers, supplierPoStats]);

  const totalPayableBdt = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (s.balance_payable || 0), 0);
  }, [suppliers]);

  const suppliersWithBalanceCount = useMemo(() => {
    return suppliers.filter(s => (s.balance_payable || 0) > 0).length;
  }, [suppliers]);

  // Pagination
  const totalItems = filteredSuppliers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedSuppliers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredSuppliers.slice(start, start + pageSize);
  }, [filteredSuppliers, safeCurrentPage, pageSize]);

  const handleRowClick = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
  };

  const handleRowDoubleClick = (supplierId: string) => {
    setActivePath(`/purchasing/suppliers/profile?supplier_id=${encodeURIComponent(supplierId)}`);
  };

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto pb-8" id="suppliers-view-container">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-base font-semibold text-[var(--text)]">Suppliers</h1>
        {can('manage_suppliers') && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded-[4px] hover:opacity-90 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add supplier
          </button>
        )}
      </div>

      {/* Data Strip */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[4px] px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Active suppliers:</span>
          <span className="font-semibold tabular-nums text-[var(--text)]">{activeSuppliersCount}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Total purchased:</span>
          <span className="font-semibold tabular-nums text-[var(--text)]">৳{totalPurchasedBdt.toLocaleString()}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Total payable:</span>
          <span className={`font-semibold tabular-nums ${totalPayableBdt > 0 ? 'text-[var(--negative)]' : 'text-[var(--text)]'}`}>
            ৳{totalPayableBdt.toLocaleString()}
          </span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Suppliers with balance:</span>
          <span className="font-semibold tabular-nums text-[var(--text)]">{suppliersWithBalanceCount}</span>
        </div>
      </div>

      {/* One-row Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-[4px] p-2 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search name, contact, phone, country..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-2.5 py-1 text-xs rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Country */}
        <select
          value={countryFilter}
          onChange={(e) => {
            setCountryFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-2.5 py-1 text-xs rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          <option value="all">All countries</option>
          {uniqueCountries.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Currency */}
        <select
          value={currencyFilter}
          onChange={(e) => {
            setCurrencyFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-2.5 py-1 text-xs rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          <option value="all">All currencies</option>
          <option value="AED">AED</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="BDT">BDT</option>
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as any);
            setCurrentPage(1);
          }}
          className="px-2.5 py-1 text-xs rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Balance */}
        <select
          value={balanceFilter}
          onChange={(e) => {
            setBalanceFilter(e.target.value as any);
            setCurrentPage(1);
          }}
          className="px-2.5 py-1 text-xs rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          <option value="all">All balances</option>
          <option value="with_balance">With balance</option>
        </select>

        {/* Min & Max Purchase */}
        <input
          type="number"
          placeholder="Min total"
          value={minPurchase}
          onChange={(e) => {
            setMinPurchase(e.target.value);
            setCurrentPage(1);
          }}
          className="w-20 px-2 py-1 text-xs tabular-nums rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        />
        <input
          type="number"
          placeholder="Max total"
          value={maxPurchase}
          onChange={(e) => {
            setMaxPurchase(e.target.value);
            setCurrentPage(1);
          }}
          className="w-20 px-2 py-1 text-xs tabular-nums rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        />

        {/* Page size */}
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="px-2 py-1 text-xs rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>

      {/* Spreadsheet Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[4px] overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[calc(100vh-270px)] relative">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-[var(--surface-sunken)] shadow-xs">
              <tr className="border-b border-[var(--border)] text-[11px] font-medium text-[var(--text-muted)]">
                <th className="sticky left-0 z-30 bg-[var(--surface-sunken)] py-2.5 px-3 whitespace-nowrap border-r border-[var(--border)]">
                  Supplier
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap">Country</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Currency</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Terms</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Phone</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">POs</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Total purchased</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Payable</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Last purchase</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {paginatedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs text-[var(--text-muted)]">
                    No suppliers match the current filters.
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((s) => {
                  const isSelected = selectedSupplierId === s.id;
                  const stats = supplierPoStats[s.id] || { lastPurchaseDate: '-', poCount: 0, computedTotalPurchased: 0 };
                  const totalPurchased = s.total_purchases_amount_bdt ?? stats.computedTotalPurchased;
                  const poCount = s.total_purchases_count ?? stats.poCount;
                  const isWithBalance = (s.balance_payable || 0) > 0;

                  return (
                    <tr
                      key={s.id}
                      onClick={() => handleRowClick(s.id)}
                      onDoubleClick={() => handleRowDoubleClick(s.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]'
                          : 'odd:bg-[var(--card)] even:bg-[var(--surface-sunken)]/40 hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <td className="sticky left-0 z-10 bg-inherit py-2 px-3 whitespace-nowrap border-r border-[var(--border)] font-medium text-[var(--text)]">
                        <div>{s.name}</div>
                        {s.contact_person && (
                          <div className="text-[10px] text-[var(--text-muted)]">{s.contact_person}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-[var(--text-muted)]">
                        {s.country || '-'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-[var(--text)]">
                        {s.currency}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-[var(--text-muted)]">
                        {s.payment_terms || '-'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap tabular-nums text-[var(--text-muted)]">
                        {s.phone || '-'}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums text-[var(--text)]">
                        {poCount}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums font-medium text-[var(--text)]">
                        ৳{totalPurchased.toLocaleString()}
                      </td>
                      <td className={`py-2 px-3 text-right whitespace-nowrap tabular-nums font-medium ${isWithBalance ? 'text-[var(--negative)]' : 'text-[var(--text)]'}`}>
                        ৳{(s.balance_payable || 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap tabular-nums text-[var(--text-muted)]">
                        {stats.lastPurchaseDate}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-xs">
                        <span className={s.active !== false ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}>
                          {s.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Numbered Pagination */}
        {totalItems > 0 && (
          <div className="p-2.5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs bg-[var(--surface-sunken)]">
            <div className="text-[var(--text-muted)]">
              Showing {(safeCurrentPage - 1) * pageSize + 1} to {Math.min(safeCurrentPage * pageSize, totalItems)} of {totalItems} suppliers
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="p-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] text-[var(--text)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                // Show condensed page numbers if totalPages > 7
                if (totalPages > 7) {
                  if (pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - safeCurrentPage) > 1) {
                    if (pageNum === 2 || pageNum === totalPages - 1) {
                      return <span key={pageNum} className="px-1 text-[var(--text-muted)]">...</span>;
                    }
                    return null;
                  }
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-6 h-6 px-1.5 text-xs rounded-[4px] border border-[var(--border)] tabular-nums cursor-pointer transition-colors ${
                      safeCurrentPage === pageNum
                        ? 'bg-[var(--accent)] text-white font-semibold'
                        : 'bg-[var(--card)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="p-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] text-[var(--text)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      <SupplierFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        supplier={null}
      />
    </div>
  );
};
