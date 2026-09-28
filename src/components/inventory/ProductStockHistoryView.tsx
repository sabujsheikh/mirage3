import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../common/PageHeader';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  ProductStockHistoryResponse,
  StockMovementReason,
} from '../../types';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Building2,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  User,
  Truck,
  ExternalLink,
  X,
} from 'lucide-react';

export interface ProductStockHistoryViewProps {
  productId?: string;
  warehouseId?: string;
  onBack?: () => void;
  isDrawer?: boolean;
}

export const ProductStockHistoryView: React.FC<ProductStockHistoryViewProps> = ({
  productId: propProductId,
  warehouseId: propWarehouseId,
  onBack,
  isDrawer = false,
}) => {
  const { products, activePath, setActivePath } = useApp();
  const { sessionToken, currentUser } = useAuth();

  // Helper to determine initial product
  const initialProductId = useMemo(() => {
    if (propProductId) return propProductId;
    if (activePath.includes('product_id=')) {
      const match = activePath.match(/product_id=([^&]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]);
    }
    const fromStorage = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('stock_history_product_id') : null;
    if (fromStorage && products.some(p => p.id === fromStorage)) {
      return fromStorage;
    }
    return products[0]?.id || '';
  }, [propProductId, activePath, products]);

  // Helper to determine initial warehouse
  const initialWarehouseId = useMemo(() => {
    if (propWarehouseId) return propWarehouseId;
    if (activePath.includes('warehouse_id=')) {
      const match = activePath.match(/warehouse_id=([^&]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]);
    }
    const fromStorage = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('stock_history_warehouse_id') : null;
    if (fromStorage) return fromStorage;
    return 'all';
  }, [propWarehouseId, activePath]);

  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(initialWarehouseId);

  // Search in product dropdown
  const [productSearch, setProductSearch] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // API State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<ProductStockHistoryResponse | null>(null);

  // Sync selected product if initialProductId changes
  useEffect(() => {
    if (initialProductId && initialProductId !== selectedProductId) {
      setSelectedProductId(initialProductId);
    }
  }, [initialProductId]);

  // Sync warehouse if initialWarehouseId changes
  useEffect(() => {
    if (initialWarehouseId && initialWarehouseId !== selectedWarehouseId) {
      setSelectedWarehouseId(initialWarehouseId);
    }
  }, [initialWarehouseId]);

  const fetchHistory = useCallback(async () => {
    if (!selectedProductId) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('page_size', String(pageSize));
      if (selectedWarehouseId !== 'all') {
        params.set('warehouse_id', selectedWarehouseId);
      }

      const token = sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('mirage_session_token') : null);
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (currentUser?.id) {
        headers['x-authenticated-user-id'] = currentUser.id;
      }

      const res = await fetch(`/api/reports/stock/${selectedProductId}/history?${params.toString()}`, { headers });
      if (!res.ok) {
        throw new Error(`Failed to load product stock history: HTTP ${res.status}`);
      }
      const data: ProductStockHistoryResponse = await res.json();
      setHistoryData(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching history');
    } finally {
      setLoading(false);
    }
  }, [selectedProductId, selectedWarehouseId, currentPage, pageSize, sessionToken, currentUser]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleProductChange = (id: string) => {
    setSelectedProductId(id);
    setCurrentPage(1);
    try {
      sessionStorage.setItem('stock_history_product_id', id);
    } catch {}
  };

  const handleWarehouseChange = (whId: string) => {
    setSelectedWarehouseId(whId);
    setCurrentPage(1);
    try {
      sessionStorage.setItem('stock_history_warehouse_id', whId);
    } catch {}
  };

  // Filtered product options for fast selection
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      p =>
        p.display_name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  const selectedProduct = products.find(p => p.id === selectedProductId) || historyData?.product;
  const summary = historyData?.summary;
  const movements = historyData?.movements || [];
  const total = historyData?.total || 0;
  const totalPages = historyData?.total_pages || 1;

  const getReasonPill = (reason: StockMovementReason, label: string) => {
    switch (reason) {
      case 'PURCHASE':
      case 'PO_RECEIVING':
      case 'OPENING_BALANCE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {label}
          </span>
        );
      case 'RETURN':
      case 'RETURN_RESTOCK':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
            {label}
          </span>
        );
      case 'SALE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            {label}
          </span>
        );
      case 'TRANSFER':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {label}
          </span>
        );
      case 'DAMAGE':
      case 'DAMAGED_WRITE_OFF':
      case 'LOSS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            {label}
          </span>
        );
      case 'PURCHASE_RETURN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            {label}
          </span>
        );
      case 'TESTER_CONVERSION':
      case 'MARKETING_SAMPLE':
      case 'GIFT':
      case 'ADJUSTMENT':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--surface-sunken)] text-[var(--text)] border border-[var(--border)]">
            {label}
          </span>
        );
    }
  };

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto pb-8">
      {/* Page Header */}
      <PageHeader
        eyebrow="Inventory & Audit"
        title="Product Stock History"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onBack) {
                  onBack();
                } else {
                  setActivePath('/inventory/stock-report');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer shadow-xs"
            >
              {isDrawer ? <X className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              {isDrawer ? 'Close Drawer' : 'Back to Stock Report'}
            </button>
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Top Selectors: Product & Location (Reusing established picker patterns) */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Product Picker */}
          <div className="lg:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-[var(--accent)]" />
                Select Perfume Product / SKU
              </label>
              {products.length > 10 && (
                <div className="relative w-44">
                  <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Quick search SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-6 pr-2 py-0.5 text-[11px] rounded bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] focus:outline-none"
                  />
                </div>
              )}
            </div>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full text-xs font-medium bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] cursor-pointer"
            >
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.display_name} — (Total On Hand: {p.stock_on_hand ?? 0} units | Retail: ৳{p.selling_price})
                </option>
              ))}
            </select>
          </div>

          {/* Location Picker */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              Warehouse Location
            </label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              className="w-full text-xs font-semibold bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] cursor-pointer"
            >
              <option value="all">All Locations (Consolidated)</option>
              <option value="wh_shop">Shop Floor (Showroom)</option>
              <option value="wh_main">Main / Back-store (2nd Floor)</option>
            </select>
          </div>
        </div>

        {/* Selected Product Quick Info Strip */}
        {selectedProduct && (
          <div className="pt-2 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[var(--accent)]">
                {selectedProduct.sku}
              </span>
              <span className="text-[var(--text-muted)]">•</span>
              <span className="font-semibold text-[var(--text)]">
                {selectedProduct.display_name}
              </span>
              {selectedProduct.brand && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text-secondary)]">
                  {selectedProduct.brand}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-[var(--text-muted)] text-[11px]">Selling Price: </span>
                <strong className="text-[var(--text)]">৳{selectedProduct.selling_price.toLocaleString()}</strong>
              </div>
              <div className="border-l border-[var(--border)] pl-4">
                <span className="text-[var(--text-muted)] text-[11px]">Avg Landed Cost: </span>
                <strong className="text-[var(--text)]">৳{selectedProduct.avg_cost.toLocaleString()}</strong>
              </div>
              <div className="border-l border-[var(--border)] pl-4">
                <span className="text-[var(--text-muted)] text-[11px]">Stock Status: </span>
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {summary ? `${summary.current_stock} units` : '-'}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Block: Inflow vs Outflow vs Current Stock */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Inflows Card */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-1.5">
                <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                  Quantities In (Inflow)
                </span>
              </div>
              <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                +{summary.total_inflow} units
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[var(--text-muted)]">Total Purchase:</span>
                <span className="font-mono font-semibold text-[var(--text)]">
                  +{summary.total_purchase}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[var(--text-muted)]">Opening Stock:</span>
                <span className="font-mono font-semibold text-[var(--text)]">
                  +{summary.opening_stock}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[var(--text-muted)]">Total Sell Return:</span>
                <span className="font-mono font-semibold text-[var(--text)]">
                  +{summary.total_sell_return}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[var(--text-muted)]">Stock Transfers In:</span>
                <span className="font-mono font-semibold text-[var(--text)]">
                  +{summary.stock_transfers_in}
                </span>
              </div>
            </div>
          </div>

          {/* Outflows Card */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                  Quantities Out (Outflow)
                </span>
              </div>
              <span className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
                -{summary.total_outflow} units
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[var(--text-muted)]">Total Sold:</span>
                <span className="font-mono font-semibold text-[var(--text)]">
                  -{summary.total_sold}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[var(--text-muted)]">Total Stock Adjustment:</span>
                <span className="font-mono font-semibold text-[var(--text)]">
                  -{summary.total_stock_adjustment}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[var(--text-muted)]">Total Purchase Return:</span>
                <span className="font-mono font-semibold text-[var(--text)]">
                  -{summary.total_purchase_return}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[var(--text-muted)]">Stock Transfers Out:</span>
                <span className="font-mono font-semibold text-[var(--text)]">
                  -{summary.stock_transfers_out}
                </span>
              </div>
            </div>
          </div>

          {/* Current Stock Card */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-[var(--accent)]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                    Current Stock Balance
                  </span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text-muted)]">
                  {selectedWarehouseId === 'all' ? 'All Warehouses' : 'Filtered Location'}
                </span>
              </div>

              <div className="mt-4 text-center">
                <div className="text-3xl font-bold font-mono text-[var(--accent)] tracking-tight">
                  {summary.current_stock}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-1 font-medium">
                  Derived running total ({summary.total_inflow} in − {summary.total_outflow} out)
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border)] grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-[var(--surface-sunken)] p-2 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] text-[var(--text-muted)] uppercase">Cost Value</div>
                <div className="font-bold font-mono text-[var(--text)]">
                  ৳{(summary.current_stock * (selectedProduct?.avg_cost || 0)).toLocaleString()}
                </div>
              </div>
              <div className="bg-[var(--surface-sunken)] p-2 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] text-[var(--text-muted)] uppercase">Sale Value</div>
                <div className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  ৳{(summary.current_stock * (selectedProduct?.selling_price || 0)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Movements Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
              Chronological Stock Ledger
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              Historical stock movements with cumulative running balance and resolved counterparties.
            </p>
          </div>
          <div className="text-xs text-[var(--text-muted)] font-mono">
            Total Movements: <strong className="text-[var(--text)]">{total}</strong>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] relative">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-[var(--surface-sunken)] shadow-xs">
              <tr className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <th className="sticky left-0 z-30 bg-[var(--surface-sunken)] py-3 px-3.5 whitespace-nowrap border-r border-[var(--border)] shadow-xs">Date & Time</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Movement Type</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Quantity Change</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">New Balance</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Reference No</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Customer / Supplier</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Warehouse</th>
                <th className="py-3 px-3.5 whitespace-nowrap min-w-[150px]">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent)]" />
                      <span>Loading movements history...</span>
                    </div>
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                    No movements recorded for this product in the selected warehouse.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isPositive = m.quantity_delta > 0;
                  const isNegative = m.quantity_delta < 0;

                  return (
                    <tr
                      key={m.id}
                      className="odd:bg-[var(--card)] even:bg-[var(--surface-sunken)]/50 hover:bg-[var(--surface-hover)] transition-colors group"
                    >
                      {/* Date & Time (Frozen Leftmost Column) */}
                      <td className="sticky left-0 z-10 py-2.5 px-3.5 whitespace-nowrap font-mono text-[var(--text-secondary)] bg-[var(--card)] group-odd:bg-[var(--card)] group-even:bg-[var(--surface-sunken)] group-hover:bg-[var(--surface-hover)] border-r border-[var(--border)] shadow-xs">
                        <div>{new Date(m.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Movement Type */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {getReasonPill(m.movement_reason, m.reason_label)}
                      </td>

                      {/* Quantity Change */}
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={
                            isPositive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isNegative
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-[var(--text-muted)]'
                          }
                        >
                          {isPositive ? `+${m.quantity_delta}` : `${m.quantity_delta}`}
                        </span>
                      </td>

                      {/* New Balance (Running Balance) */}
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-[var(--text)] whitespace-nowrap">
                        {m.new_quantity}
                      </td>

                      {/* Reference No */}
                      <td className="py-2.5 px-3.5 font-mono text-xs whitespace-nowrap">
                        <span className="font-semibold text-[var(--accent)]">
                          {m.reference_id || '-'}
                        </span>
                      </td>

                      {/* Customer / Supplier (Using Part 0 resolver) */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {m.party_name ? (
                          <div className="flex items-center gap-1.5">
                            {m.customer_name ? (
                              <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            ) : (
                              <Truck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                            <span className="font-medium text-[var(--text)]">
                              {m.party_name}
                            </span>
                            <span className="text-[9px] font-semibold uppercase px-1 py-0.2 rounded bg-[var(--surface-sunken)] text-[var(--text-muted)] border border-[var(--border)]">
                              {m.customer_name ? 'Customer' : 'Supplier'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                      </td>

                      {/* Warehouse */}
                      <td className="py-2.5 px-3.5 text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                        {m.warehouse_name || m.warehouse_id}
                      </td>

                      {/* Notes */}
                      <td className="py-2.5 px-3.5 text-[11px] text-[var(--text-muted)] max-w-xs truncate">
                        {m.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-sunken)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-[var(--text-muted)]">
            Showing{' '}
            <strong className="text-[var(--text)]">
              {total > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-[var(--text)]">
              {Math.min(currentPage * pageSize, total)}
            </strong>{' '}
            of <strong className="text-[var(--text)]">{total}</strong> movements
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[var(--card)] border border-[var(--border)] rounded px-1.5 py-1 text-xs text-[var(--text)] cursor-pointer focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="p-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 text-xs font-semibold text-[var(--text)] font-mono">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="p-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
