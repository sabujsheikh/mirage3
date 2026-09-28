import React, { useMemo, useState } from 'react';
import {
  Layers,
  PackageX,
  Search,
  FileText,
  Calendar,
  Warehouse as WarehouseIcon,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowUpDown,
  History,
  Eye,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Product, ProductBatch, StockMovement, Order } from '../../types';
import { PageHeader } from '../common/PageHeader';
import { Modal } from '../common/Modal';

export const BatchesView: React.FC = () => {
  const { batches, damagedStock, products, stockMovements, orders } = useApp();
  const { can } = useAuth();

  const [tab, setTab] = useState<'batches' | 'damaged'>('batches');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'maturing' | 'ready' | 'expired' | 'depleted'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modal inspection states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<ProductBatch | null>(null);
  const [batchTab, setBatchTab] = useState<'active' | 'history'>('active');

  const fmtDate = (iso?: string): string => {
    if (!iso) return '\u2014';
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '\u2014';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const calcMaturityDays = (mfgDate?: string): number | null => {
    if (!mfgDate) return null;
    const match = mfgDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    let mfgYear: number, mfgMonth: number, mfgDay: number;
    if (match) {
      mfgYear = parseInt(match[1], 10);
      mfgMonth = parseInt(match[2], 10) - 1;
      mfgDay = parseInt(match[3], 10);
    } else {
      const d = new Date(mfgDate);
      if (isNaN(d.getTime())) return null;
      mfgYear = d.getFullYear();
      mfgMonth = d.getMonth();
      mfgDay = d.getDate();
    }
    const now = new Date();
    const mfgUtc = Date.UTC(mfgYear, mfgMonth, mfgDay);
    const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((nowUtc - mfgUtc) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Group batches by product
  const batchesByProduct = useMemo(() => {
    const map = new Map<string, ProductBatch[]>();
    batches.forEach((b) => {
      const list = map.get(b.product_id) || [];
      list.push(b);
      map.set(b.product_id, list);
    });
    return map;
  }, [batches]);

  // Aggregate product rows
  interface ProductBatchSummary {
    product: Product;
    allLots: ProductBatch[];
    activeLots: ProductBatch[];
    depletedLots: ProductBatch[];
    totalAvailable: number;
    latestImportDate: string | null;
    hasMaturing: boolean;
    hasReady: boolean;
    hasExpired: boolean;
    isDepleted: boolean;
  }

  const productSummaries: ProductBatchSummary[] = useMemo(() => {
    const nowMs = Date.now();
    return products.map((product) => {
      const allLots = batchesByProduct.get(product.id) || [];
      const activeLots = allLots.filter((b) => b.quantity_remaining > 0);
      const depletedLots = allLots.filter((b) => b.quantity_remaining <= 0);

      const totalAvailable =
        activeLots.length > 0
          ? activeLots.reduce((sum, b) => sum + b.quantity_remaining, 0)
          : (product.stock_available ?? 0);

      let latestImportDate: string | null = null;
      let latestMs = 0;
      allLots.forEach((b) => {
        const dateStr = b.import_date || b.received_at || b.created_at;
        if (dateStr) {
          const ms = new Date(dateStr).getTime();
          if (!isNaN(ms) && ms > latestMs) {
            latestMs = ms;
            latestImportDate = dateStr;
          }
        }
      });

      const hasMaturing = activeLots.some((b) => b.maturation_status === 'MATURING');
      const hasReady = activeLots.some((b) => b.maturation_status === 'READY');
      const hasExpired = activeLots.some((b) => {
        if (!b.expiry_date) return false;
        const expMs = new Date(b.expiry_date).getTime();
        return !isNaN(expMs) && expMs < nowMs;
      });
      const isDepleted = allLots.length > 0 && activeLots.length === 0;

      return {
        product,
        allLots,
        activeLots,
        depletedLots,
        totalAvailable,
        latestImportDate,
        hasMaturing,
        hasReady,
        hasExpired,
        isDepleted,
      };
    });
  }, [products, batchesByProduct]);

  // Filter products by search and status
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return productSummaries.filter((item) => {
      // Status filter
      if (statusFilter === 'active' && item.activeLots.length === 0) return false;
      if (statusFilter === 'maturing' && !item.hasMaturing) return false;
      if (statusFilter === 'ready' && !item.hasReady) return false;
      if (statusFilter === 'expired' && !item.hasExpired) return false;
      if (statusFilter === 'depleted' && !item.isDepleted) return false;

      // Search filter
      if (!q) return true;

      const p = item.product;
      const matchName = (p.display_name || '').toLowerCase().includes(q);
      const matchSku = (p.sku || '').toLowerCase().includes(q);
      const matchBarcode = (p.barcode || '').toLowerCase().includes(q);
      const matchBrand = (p.brand || '').toLowerCase().includes(q);
      const matchLot = item.allLots.some(
        (b) =>
          (b.batch_code || '').toLowerCase().includes(q) ||
          (b.manufacturer || '').toLowerCase().includes(q)
      );

      return matchName || matchSku || matchBarcode || matchBrand || matchLot;
    });
  }, [productSummaries, search, statusFilter]);

  // Paginated product rows
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedProducts = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, safeCurrentPage, pageSize]);

  // Damaged stock tab filtering
  const productName = (id: string) => products.find((p) => p.id === id)?.display_name || 'Unknown product';

  const filteredDamaged = useMemo(() => {
    if (!search.trim()) return damagedStock;
    const q = search.toLowerCase();
    return damagedStock.filter(
      (d) => productName(d.product_id).toLowerCase().includes(q) || (d.batch_code || '').toLowerCase().includes(q)
    );
  }, [damagedStock, search, products]);

  // Handler for row click
  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setBatchTab('active');
  };

  // Batches for the currently selected product
  const selectedProductBatches = useMemo(() => {
    if (!selectedProduct) return [];
    return batchesByProduct.get(selectedProduct.id) || [];
  }, [selectedProduct, batchesByProduct]);

  const activeSelectedBatches = useMemo(() => {
    return selectedProductBatches.filter((b) => b.quantity_remaining > 0);
  }, [selectedProductBatches]);

  // Lifecycle data for the selected batch
  const batchStockMovements = useMemo(() => {
    if (!selectedBatch) return [];
    return stockMovements
      .filter((m) => {
        if (m.product_id !== selectedBatch.product_id) return false;
        const notesMatch = m.notes && m.notes.includes(selectedBatch.batch_code);
        const refMatch = m.reference_id === selectedBatch.batch_code || m.reference_id === selectedBatch.id;
        return notesMatch || refMatch;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [selectedBatch, stockMovements]);

  const batchOrders = useMemo(() => {
    if (!selectedBatch) return [];
    return orders
      .filter((o) => {
        return o.items.some((item) => {
          if (item.product_id !== selectedBatch.product_id) return false;
          if (item.batch_code === selectedBatch.batch_code || item.batch_id === selectedBatch.id) return true;
          if (item.allocations && item.allocations.some((a) => a.batch_id === selectedBatch.id || a.batch_code === selectedBatch.batch_code)) return true;
          return false;
        });
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [selectedBatch, orders]);

  const batchDamaged = useMemo(() => {
    if (!selectedBatch) return [];
    return damagedStock.filter(
      (d) => d.product_id === selectedBatch.product_id && d.batch_code === selectedBatch.batch_code
    );
  }, [selectedBatch, damagedStock]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Inventory"
        title="Batches"
        desc={`${products.length} Products \u00B7 ${batches.length} Total Lots`}
      />

      {/* Tabs and Search / Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
            <button
              onClick={() => setTab('batches')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                tab === 'batches'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Batches ({products.length} Products)
            </button>
            <button
              onClick={() => setTab('damaged')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                tab === 'damaged'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              <PackageX className="w-3.5 h-3.5" /> Damaged Stock ({damagedStock.length})
            </button>
          </div>

          {tab === 'batches' && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="erp-select text-xs py-1.5"
            >
              <option value="all">All Products</option>
              <option value="active">Active Lots</option>
              <option value="maturing">Maturing</option>
              <option value="ready">Ready</option>
              <option value="expired">Expired</option>
              <option value="depleted">Depleted</option>
            </select>
          )}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={tab === 'batches' ? 'Search product, SKU, barcode, lot...' : 'Search damaged stock...'}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {/* Main Content Table */}
      <div className="dense-table-container">
        <div className="overflow-x-auto">
          {tab === 'batches' ? (
            <table className="dense-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-center">Active Lots</th>
                  <th className="text-right">Total Available</th>
                  <th>Latest Import</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedProducts.map((item) => {
                  const p = item.product;
                  const activeCount = item.activeLots.length;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleProductClick(p)}
                      className="dense-table-row cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <td>
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--text)] text-[13px]">{p.display_name}</div>
                          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-num">
                            <span className="font-semibold text-[var(--accent)]">{p.sku}</span>
                            {p.barcode && <span>&#183; {p.barcode}</span>}
                            <span>&#183; {p.brand}</span>
                          </div>
                        </div>
                      </td>
                      <td className="font-num text-center">
                        <span className="font-semibold text-[13px] text-[var(--text)]">{activeCount}</span>
                        {item.allLots.length > activeCount && (
                          <span className="text-[11px] text-[var(--text-muted)] ml-1">
                            ({item.allLots.length} total)
                          </span>
                        )}
                      </td>
                      <td className="font-num text-right font-semibold text-[13px] text-[var(--accent)]">
                        {item.totalAvailable} pcs
                      </td>
                      <td className="font-num text-[var(--text-secondary)] text-[12px]">
                        {fmtDate(item.latestImportDate || undefined)}
                      </td>
                      <td>
                        {activeCount > 0 ? (
                          <span className="pill-green inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border">
                            {activeCount} Active
                          </span>
                        ) : item.allLots.length > 0 ? (
                          <span className="pill-gray inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border">
                            Depleted
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-[11px] font-num">&#8212;</span>
                        )}
                        {item.hasExpired && (
                          <span className="pill-red inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold border ml-1">
                            Expired Lot
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductClick(p);
                          }}
                          className="erp-btn-secondary py-1 px-2.5 text-[11px] inline-flex items-center gap-1"
                        >
                          View Batches <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                      <FileText className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      No products found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="dense-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Severity</th>
                  <th>Source</th>
                  <th>Batch</th>
                  <th>Warehouse</th>
                  <th>Notes</th>
                  <th>Logged</th>
                </tr>
              </thead>
              <tbody>
                {filteredDamaged.map((d) => (
                  <tr key={d.id} className="dense-table-row">
                    <td>{d.product_name || productName(d.product_id)}</td>
                    <td className="font-num font-semibold text-[var(--status-red)]">{d.quantity}</td>
                    <td>
                      <span
                        className={`pill-${
                          d.severity === 'heavy' ? 'red' : d.severity === 'medium' ? 'amber' : 'gray'
                        } inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border capitalize`}
                      >
                        {d.severity}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border pill-teal capitalize">
                        {d.source}
                      </span>
                    </td>
                    <td className="font-mono text-[var(--text-muted)]">{d.batch_code || '\u2014'}</td>
                    <td className="text-[var(--text-muted)]">
                      {d.warehouse_id === 'wh_main'
                        ? 'Main / Back-store'
                        : d.warehouse_id === 'wh_shop'
                        ? 'Shop Floor'
                        : d.warehouse_id}
                    </td>
                    <td className="max-w-[240px] truncate text-[var(--text-muted)]" title={d.notes}>
                      {d.notes || '\u2014'}
                    </td>
                    <td className="font-num text-[var(--text-muted)]">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString() : '\u2014'}
                    </td>
                  </tr>
                ))}
                {filteredDamaged.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                      <FileText className="w-6 h-6 mx-auto mb-2 opacity-40" /> No damaged stock recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Strip */}
        {tab === 'batches' && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[var(--border)] text-xs text-[var(--text-secondary)]">
            <div className="font-num">
              {filteredProducts.length > 0 ? (
                <>
                  Showing {(safeCurrentPage - 1) * pageSize + 1}&#8211;
                  {Math.min(safeCurrentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} Products
                </>
              ) : (
                '0 Products'
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="erp-select py-1 px-2 text-xs"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="erp-btn-secondary py-1 px-2.5 text-xs disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="font-num px-1">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="erp-btn-secondary py-1 px-2.5 text-xs disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Batches Workspace Modal */}
      {selectedProduct && (
        <Modal
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          title={selectedProduct.display_name}
          subtitle={`SKU: ${selectedProduct.sku} \u00B7 Barcode: ${selectedProduct.barcode || '\u2014'} \u00B7 Stock Available: ${selectedProduct.stock_available ?? 0} pcs`}
          size="xl"
        >
          <div className="space-y-4">
            {/* Modal Tabs */}
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
              <button
                type="button"
                onClick={() => setBatchTab('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  batchTab === 'active'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] bg-[var(--surface-sunken)]'
                }`}
              >
                Active Batches ({activeSelectedBatches.length})
              </button>
              <button
                type="button"
                onClick={() => setBatchTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  batchTab === 'history'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] bg-[var(--surface-sunken)]'
                }`}
              >
                Batch History ({selectedProductBatches.length})
              </button>
            </div>

            {/* Active Batches Tab Content */}
            {batchTab === 'active' && (
              <div className="space-y-2.5">
                {activeSelectedBatches.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-lg">
                    No active batches currently in stock for this product.
                  </div>
                ) : (
                  activeSelectedBatches.map((b) => {
                    const maturityDays = calcMaturityDays(b.manufacturing_date);

                    return (
                      <div
                        key={b.id}
                        className="border border-[var(--border)] rounded-lg p-3.5 bg-[var(--card)] hover:border-[var(--accent)] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-[var(--accent)] tracking-tight">
                                {b.batch_code || '\u2014'}
                              </span>
                              {b.manufacturer && (
                                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                                  ({b.manufacturer})
                                </span>
                              )}
                              {b.authenticity_status && (
                                <span
                                  className={`pill-${
                                    b.authenticity_status === 'verified'
                                      ? 'green'
                                      : b.authenticity_status === 'questionable'
                                      ? 'red'
                                      : 'gray'
                                  } inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border capitalize`}
                                >
                                  {b.authenticity_status}
                                </span>
                              )}
                            </div>
                            <div className="text-[12px] text-[var(--text-secondary)] mt-0.5 flex items-center gap-1.5">
                              <WarehouseIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                              <span>{b.warehouse_name || b.location || '\u2014'}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-num font-bold text-[14px] text-[var(--text)]">
                              {b.quantity_remaining} pcs
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedBatch(b)}
                              className="erp-btn-secondary py-1 px-2 text-[11px] mt-1 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3 text-[var(--text-muted)]" /> Batch Details
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 mt-3 pt-2.5 border-t border-[var(--border)] text-[11px] font-num">
                          <div>
                            <span className="text-[var(--text-muted)] block">MFG Date</span>
                            <span className="text-[var(--text)] font-medium">{fmtDate(b.manufacturing_date)}</span>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)] block">EXP Date</span>
                            <span className="text-[var(--text)] font-medium">{fmtDate(b.expiry_date)}</span>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)] block">Maturity</span>
                            <span className="text-[var(--text)] font-semibold text-[var(--accent)]">
                              {maturityDays !== null ? `${maturityDays} days` : '\u2014'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)] block">Import Date</span>
                            <span className="text-[var(--text)] font-medium">
                              {fmtDate(b.import_date || b.received_at)}
                            </span>
                          </div>
                          {can('view_cost_margin') && (
                            <div>
                              <span className="text-[var(--text-muted)] block">Unit Cost</span>
                              <span className="text-[var(--text)] font-medium">
                                {b.purchase_cost !== undefined ? `\u09F3${b.purchase_cost.toLocaleString()}` : '\u2014'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Batch History Tab Content */}
            {batchTab === 'history' && (
              <div className="space-y-2">
                {selectedProductBatches.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-lg">
                    No batch history recorded for this product.
                  </div>
                ) : (
                  <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                    <table className="dense-table w-full">
                      <thead>
                        <tr>
                          <th>Batch / Lot</th>
                          <th>Warehouse</th>
                          <th className="text-right">Received</th>
                          <th className="text-right">Sold / Consumed</th>
                          <th className="text-right">Remaining</th>
                          <th>Status</th>
                          <th>MFG Date</th>
                          <th>Maturity</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProductBatches.map((b) => {
                          const isDepleted = b.quantity_remaining <= 0;
                          const consumed = Math.max(0, b.quantity_received - b.quantity_remaining);
                          const maturityDays = calcMaturityDays(b.manufacturing_date);

                          return (
                            <tr key={b.id} className="dense-table-row">
                              <td className="font-mono font-bold text-[var(--accent)] text-[12px]">{b.batch_code}</td>
                              <td className="text-[var(--text-secondary)] text-[11px]">
                                {b.warehouse_name || b.location || '\u2014'}
                              </td>
                              <td className="font-num text-right text-[12px]">{b.quantity_received}</td>
                              <td className="font-num text-right text-[12px] text-[var(--text-secondary)]">{consumed}</td>
                              <td className="font-num text-right font-semibold text-[12px] text-[var(--text)]">
                                {b.quantity_remaining}
                              </td>
                              <td>
                                {isDepleted ? (
                                  <span className="pill-gray inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border">
                                    Depleted
                                  </span>
                                ) : (
                                  <span className="pill-green inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border">
                                    Active
                                  </span>
                                )}
                              </td>
                              <td className="font-num text-[11px] text-[var(--text-secondary)]">
                                {fmtDate(b.manufacturing_date)}
                              </td>
                              <td className="font-num text-[11px] text-[var(--text)]">
                                {maturityDays !== null ? `${maturityDays}d` : '\u2014'}
                              </td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedBatch(b)}
                                  className="erp-btn-secondary py-0.5 px-2 text-[10px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Individual Batch Lifecycle Detail Modal */}
      {selectedBatch && (
        <Modal
          isOpen={!!selectedBatch}
          onClose={() => setSelectedBatch(null)}
          title={`Batch Details: ${selectedBatch.batch_code}`}
          subtitle={`${selectedProduct?.display_name || productName(selectedBatch.product_id)}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="border border-[var(--border)] rounded-lg p-2.5 bg-[var(--surface-sunken)]">
                <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Remaining Stock</div>
                <div className="text-base font-bold font-num text-[var(--accent)] mt-0.5">
                  {selectedBatch.quantity_remaining} pcs
                </div>
                <div className="text-[10px] text-[var(--text-muted)] font-num">
                  of {selectedBatch.quantity_received} received
                </div>
              </div>

              <div className="border border-[var(--border)] rounded-lg p-2.5 bg-[var(--surface-sunken)]">
                <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Maturity / Age</div>
                <div className="text-base font-bold font-num text-[var(--text)] mt-0.5">
                  {calcMaturityDays(selectedBatch.manufacturing_date) !== null
                    ? `${calcMaturityDays(selectedBatch.manufacturing_date)} days`
                    : '\u2014'}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">From Manufacturing Date</div>
              </div>

              <div className="border border-[var(--border)] rounded-lg p-2.5 bg-[var(--surface-sunken)]">
                <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Warehouse Location</div>
                <div className="text-xs font-semibold text-[var(--text)] mt-0.5 truncate">
                  {selectedBatch.warehouse_name || selectedBatch.location || '\u2014'}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {selectedBatch.location ? `Shelf: ${selectedBatch.location}` : 'Primary Rack'}
                </div>
              </div>

              <div className="border border-[var(--border)] rounded-lg p-2.5 bg-[var(--surface-sunken)]">
                <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Authenticity</div>
                <div className="mt-0.5">
                  <span
                    className={`pill-${
                      selectedBatch.authenticity_status === 'verified'
                        ? 'green'
                        : selectedBatch.authenticity_status === 'questionable'
                        ? 'red'
                        : 'gray'
                    } inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border capitalize`}
                  >
                    {selectedBatch.authenticity_status || 'Unverified'}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {selectedBatch.maturation_status ? `Status: ${selectedBatch.maturation_status}` : 'Standard lot'}
                </div>
              </div>
            </div>

            {/* Complete Specifications Grid */}
            <div className="border border-[var(--border)] rounded-lg p-3 bg-[var(--card)]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Batch Lifecycle Specifications
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-xs font-num">
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Batch / Lot Code</span>
                  <span className="font-mono font-semibold text-[var(--accent)]">{selectedBatch.batch_code}</span>
                </div>
                {selectedBatch.manufacturer && (
                  <div>
                    <span className="text-[var(--text-muted)] block text-[11px]">Manufacturer Lot</span>
                    <span className="font-mono font-medium">{selectedBatch.manufacturer}</span>
                  </div>
                )}
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Manufacturing Date</span>
                  <span>{fmtDate(selectedBatch.manufacturing_date)}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Expiry Date</span>
                  <span>{fmtDate(selectedBatch.expiry_date)}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Import / Received</span>
                  <span>{fmtDate(selectedBatch.import_date || selectedBatch.received_at)}</span>
                </div>
                {can('view_cost_margin') && (
                  <div>
                    <span className="text-[var(--text-muted)] block text-[11px]">Unit Landed Cost</span>
                    <span>
                      {selectedBatch.purchase_cost !== undefined
                        ? `\u09F3${selectedBatch.purchase_cost.toLocaleString()}`
                        : '\u2014'}
                    </span>
                  </div>
                )}
                {selectedBatch.selling_price !== undefined && (
                  <div>
                    <span className="text-[var(--text-muted)] block text-[11px]">Selling Price</span>
                    <span>{`\u09F3${selectedBatch.selling_price.toLocaleString()}`}</span>
                  </div>
                )}
                {selectedBatch.supplier_name && (
                  <div>
                    <span className="text-[var(--text-muted)] block text-[11px]">Supplier</span>
                    <span>{selectedBatch.supplier_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Related Orders / Sales */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Related Orders &amp; Sales ({batchOrders.length})
              </div>
              {batchOrders.length === 0 ? (
                <div className="py-3 px-3 text-xs text-[var(--text-muted)] border border-[var(--border)] rounded-lg bg-[var(--surface-sunken)]">
                  No sales or order allocations recorded yet for this lot.
                </div>
              ) : (
                <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  <table className="dense-table w-full">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th className="text-right">Qty</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchOrders.map((o) => {
                        const matchedItem = o.items.find(
                          (item) =>
                            item.product_id === selectedBatch.product_id &&
                            (item.batch_code === selectedBatch.batch_code ||
                              item.batch_id === selectedBatch.id ||
                              (item.allocations &&
                                item.allocations.some(
                                  (a) =>
                                    a.batch_id === selectedBatch.id ||
                                    a.batch_code === selectedBatch.batch_code
                                )))
                        );
                        return (
                          <tr key={o.id} className="dense-table-row">
                            <td className="font-mono font-semibold text-[var(--accent)] text-[11px]">
                              {o.invoice_number}
                            </td>
                            <td className="font-num text-[11px] text-[var(--text-secondary)]">
                              {fmtDate(o.created_at)}
                            </td>
                            <td className="text-[11px] text-[var(--text)]">{o.customer_name}</td>
                            <td className="font-num text-right text-[11px] font-semibold">
                              {matchedItem ? matchedItem.quantity : '\u2014'}
                            </td>
                            <td>
                              <span className="pill-gray inline-flex items-center rounded-full px-1.5 py-0.2 text-[9px] font-bold border capitalize">
                                {o.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Related Stock Movements */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Related Stock Movements ({batchStockMovements.length})
              </div>
              {batchStockMovements.length === 0 ? (
                <div className="py-3 px-3 text-xs text-[var(--text-muted)] border border-[var(--border)] rounded-lg bg-[var(--surface-sunken)]">
                  No stock movements explicitly referencing this lot.
                </div>
              ) : (
                <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  <table className="dense-table w-full">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reason</th>
                        <th>Warehouse</th>
                        <th className="text-right">Change</th>
                        <th>User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchStockMovements.map((m) => (
                        <tr key={m.id} className="dense-table-row">
                          <td className="font-num text-[11px] text-[var(--text-secondary)]">
                            {fmtDate(m.created_at)}
                          </td>
                          <td className="text-[11px] font-medium">{m.movement_reason}</td>
                          <td className="text-[11px] text-[var(--text-muted)]">{m.warehouse_name}</td>
                          <td
                            className={`font-num text-right text-[11px] font-semibold ${
                              m.quantity_delta > 0 ? 'text-[var(--status-green)]' : 'text-[var(--status-red)]'
                            }`}
                          >
                            {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                          </td>
                          <td className="text-[11px] text-[var(--text-muted)]">{m.created_by_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Damaged Stock Logs if any */}
            {batchDamaged.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--status-red)] mb-1.5">
                  Damaged Stock Logged ({batchDamaged.length})
                </div>
                <div className="space-y-1.5">
                  {batchDamaged.map((d) => (
                    <div
                      key={d.id}
                      className="border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-lg p-2.5 bg-[color-mix(in_srgb,var(--status-red)_6%,transparent)] text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-[var(--status-red)]">{d.quantity} units</span> &#183;{' '}
                        <span className="capitalize">{d.severity} severity</span> &#183; Source: {d.source}
                        {d.notes && <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{d.notes}</div>}
                      </div>
                      <span className="font-num text-[11px] text-[var(--text-muted)]">{fmtDate(d.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
