import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, RefreshCw, Search, Download, FileText, Printer, SlidersHorizontal, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import jsPDF from 'jspdf';

interface ItemHistoryLineRow {
  id: string;
  sale_date: string;
  invoice_number: string;
  order_id: string;
  sku: string;
  product_name: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
  status: string;
  channel: string;
  sale_type: string;
  batch_code: string;
  is_return: boolean;
}

interface ItemHistoryProductRow {
  product_id: string;
  sku: string;
  product_name: string;
  times_bought: number;
  units_bought: number;
  units_returned: number;
  net_units: number;
  net_value: number;
  average_unit_price: number;
  last_unit_price: number;
  first_bought: string;
  last_bought: string;
}

interface ItemHistoryResponse {
  customer: {
    id: string;
    name: string;
    phone: string;
    effective_type: 'retail' | 'wholesale';
  };
  summary: {
    net_units: number;
    distinct_products: number;
    line_items: number;
    net_value: number;
    returned_units: number;
    first_purchase_date: string;
    last_purchase_date: string;
    has_mixed_sale_types: boolean;
  };
  view: 'lines' | 'products';
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  lines: ItemHistoryLineRow[];
  products: ItemHistoryProductRow[];
}

export const CustomerItemHistoryView: React.FC = () => {
  const { activePath, setActivePath } = useApp();
  const { sessionToken } = useAuth();

  const customerId = useMemo(() => {
    const match = activePath.match(/customer_id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }, [activePath]);

  const initialViewFromUrl = useMemo(() => {
    const match = activePath.match(/view=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [activePath]);

  const storageKey = `mirage_customer_item_history_state_${customerId}`;

  // Restore state from sessionStorage
  const savedState = useMemo(() => {
    try {
      const item = sessionStorage.getItem(storageKey);
      return item ? JSON.parse(item) : {};
    } catch {
      return {};
    }
  }, [storageKey]);

  const [view, setView] = useState<'lines' | 'products'>(initialViewFromUrl === 'products' ? 'products' : (savedState.view || 'lines'));
  const [searchQuery, setSearchQuery] = useState<string>(savedState.searchQuery || '');
  const [dateFrom, setDateFrom] = useState<string>(savedState.dateFrom || '');
  const [dateTo, setDateTo] = useState<string>(savedState.dateTo || '');
  const [productIdFilter, setProductIdFilter] = useState<string>(savedState.productIdFilter || '');
  const [statusFilter, setStatusFilter] = useState<string>(savedState.statusFilter || 'default');
  const [pageSize, setPageSize] = useState<number>(savedState.pageSize || 25);
  const [currentPage, setCurrentPage] = useState<number>(savedState.currentPage || 1);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(savedState.selectedRowId || null);

  const [data, setData] = useState<ItemHistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Column visibility state
  const [showColMenu, setShowColMenu] = useState<boolean>(false);
  const [hiddenCols, setHiddenCols] = useState<Record<string, boolean>>(savedState.hiddenCols || {});

  // Save state to sessionStorage
  useEffect(() => {
    if (!customerId) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        view,
        searchQuery,
        dateFrom,
        dateTo,
        productIdFilter,
        statusFilter,
        pageSize,
        currentPage,
        selectedRowId,
        hiddenCols,
      }));
    } catch {
      // ignore
    }
  }, [
    customerId,
    storageKey,
    view,
    searchQuery,
    dateFrom,
    dateTo,
    productIdFilter,
    statusFilter,
    pageSize,
    currentPage,
    selectedRowId,
    hiddenCols,
  ]);

  const fetchHistory = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('page_size', String(pageSize));
      params.set('view', view);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (productIdFilter) params.set('product_id', productIdFilter);
      if (statusFilter) params.set('status', statusFilter);

      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/item-history?${params.toString()}`, { headers });
      if (!res.ok) {
        if (res.status === 404) throw new Error('Customer not found');
        throw new Error('Failed to load item history');
      }
      const json: ItemHistoryResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading item history');
    } finally {
      setLoading(false);
    }
  }, [customerId, currentPage, pageSize, view, searchQuery, dateFrom, dateTo, productIdFilter, statusFilter, sessionToken]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const customer = data?.customer;
  const summary = data?.summary;
  const lines = data?.lines || [];
  const products = data?.products || [];
  const totalCount = data?.total_count || 0;
  const totalPages = data?.total_pages || 1;
  const hasMixedSaleTypes = summary?.has_mixed_sale_types || false;

  // Unique products for the dropdown filter
  const distinctProductsList = useMemo(() => {
    return products.map(p => ({
      id: p.product_id,
      name: p.product_name,
      sku: p.sku,
    }));
  }, [products]);

  // Export CSV
  const handleExportCsv = () => {
    if (!data) return;
    const now = new Date().toISOString().slice(0, 10);
    const custName = (customer?.name || 'customer').replace(/\s+/g, '_');

    if (view === 'lines') {
      const headers = [
        'Date',
        'Invoice',
        'SKU',
        'Product',
        'Qty',
        'Unit Price (BDT)',
        'Discount (BDT)',
        'Line Total (BDT)',
        'Status',
        'Channel',
        'Batch',
        ...(hasMixedSaleTypes ? ['Sale Type'] : []),
      ];
      const rows = lines.map(r => [
        r.sale_date ? r.sale_date.slice(0, 10) : '',
        r.invoice_number,
        r.sku,
        r.product_name,
        r.quantity,
        r.unit_price,
        r.discount_amount,
        r.total_price,
        r.status,
        r.channel,
        r.batch_code,
        ...(hasMixedSaleTypes ? [r.sale_type] : []),
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${custName}_item_history_lines_${now}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = [
        'SKU',
        'Product',
        'Times Bought',
        'Units Bought',
        'Units Returned',
        'Net Units',
        'Net Value (BDT)',
        'Average Unit Price (BDT)',
        'Last Unit Price (BDT)',
        'First Bought',
        'Last Bought',
      ];
      const rows = products.map(p => [
        p.sku,
        p.product_name,
        p.times_bought,
        p.units_bought,
        p.units_returned,
        p.net_units,
        p.net_value,
        p.average_unit_price,
        p.last_unit_price,
        p.first_bought,
        p.last_bought,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${custName}_item_history_products_${now}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Export PDF
  const handleExportPdf = () => {
    if (!data) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const custName = customer?.name || 'Customer';
    const custPhone = customer?.phone || '';
    const dateStr = new Date().toLocaleDateString();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Item History: ${custName} (${custPhone})`, 10, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${dateStr} \u00B7 View: ${view === 'lines' ? 'Line Items' : 'By Product'} \u00B7 Net Value: BDT ${(summary?.net_value || 0).toLocaleString()}`, 10, 18);
    doc.setTextColor(20, 20, 20);

    let y = 26;
    if (view === 'lines') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Date', 10, y);
      doc.text('Invoice', 35, y);
      doc.text('SKU', 65, y);
      doc.text('Product', 90, y);
      doc.text('Qty', 170, y, { align: 'right' });
      doc.text('Price', 195, y, { align: 'right' });
      doc.text('Total', 225, y, { align: 'right' });
      doc.text('Status', 245, y);
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(10, y, 285, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      lines.forEach(r => {
        if (y > 190) {
          doc.addPage();
          y = 15;
        }
        doc.text(r.sale_date ? r.sale_date.slice(0, 10) : '', 10, y);
        doc.text(r.invoice_number, 35, y);
        doc.text(r.sku, 65, y);
        doc.text(r.product_name.slice(0, 38), 90, y);
        doc.text(String(r.quantity), 170, y, { align: 'right' });
        doc.text(r.unit_price.toLocaleString(), 195, y, { align: 'right' });
        doc.text(r.total_price.toLocaleString(), 225, y, { align: 'right' });
        doc.text(r.status, 245, y);
        y += 5;
      });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('SKU', 10, y);
      doc.text('Product', 40, y);
      doc.text('Times', 130, y, { align: 'right' });
      doc.text('Units', 155, y, { align: 'right' });
      doc.text('Returned', 180, y, { align: 'right' });
      doc.text('Net Units', 205, y, { align: 'right' });
      doc.text('Net Value', 235, y, { align: 'right' });
      doc.text('Avg Price', 260, y, { align: 'right' });
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(10, y, 285, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      products.forEach(p => {
        if (y > 190) {
          doc.addPage();
          y = 15;
        }
        doc.text(p.sku, 10, y);
        doc.text(p.product_name.slice(0, 45), 40, y);
        doc.text(String(p.times_bought), 130, y, { align: 'right' });
        doc.text(String(p.units_bought), 155, y, { align: 'right' });
        doc.text(String(p.units_returned), 180, y, { align: 'right' });
        doc.text(String(p.net_units), 205, y, { align: 'right' });
        doc.text(p.net_value.toLocaleString(), 235, y, { align: 'right' });
        doc.text(p.average_unit_price.toLocaleString(), 260, y, { align: 'right' });
        y += 5;
      });
    }

    doc.save(`${(custName).replace(/\s+/g, '_')}_item_history_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  const toggleColumn = (colKey: string) => {
    setHiddenCols(prev => ({
      ...prev,
      [colKey]: !prev[colKey],
    }));
  };

  const handleLineDoubleClick = (row: ItemHistoryLineRow) => {
    if (row.order_id) {
      setActivePath(`/orders?order_id=${encodeURIComponent(row.order_id)}`);
    }
  };

  const handleProductDoubleClick = (prod: ItemHistoryProductRow) => {
    setProductIdFilter(prod.product_id);
    setView('lines');
    setCurrentPage(1);
  };

  if (loading && !data) {
    return <div className="p-6 text-xs text-[var(--text-muted)]">Loading item history...</div>;
  }

  if (error && !data) {
    return (
      <div className="space-y-3 max-w-7xl mx-auto pb-8">
        <div className="p-3 bg-[var(--negative)]/10 border border-[var(--negative)]/20 rounded-[4px] text-xs text-[var(--negative)]">
          {error}
        </div>
        <button
          onClick={() => setActivePath(`/customers/profile?customer_id=${encodeURIComponent(customerId)}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to profile
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto pb-8 print:p-0 print:max-w-none" id="customer-item-history-container">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-base font-semibold text-[var(--text)]">
          {customer?.name} ({customer?.phone})
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePath(`/customers/profile?customer_id=${encodeURIComponent(customerId)}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to profile
          </button>
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Data Strip */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[4px] px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Net units:</span>
          <span className="font-semibold tabular-nums text-[var(--text)]">{summary?.net_units ?? 0}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Distinct products:</span>
          <span className="font-semibold tabular-nums text-[var(--text)]">{summary?.distinct_products ?? 0}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Line items:</span>
          <span className="font-semibold tabular-nums text-[var(--text)]">{summary?.line_items ?? 0}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Net value:</span>
          <span className="font-semibold tabular-nums text-[var(--text)]">৳{(summary?.net_value ?? 0).toLocaleString()}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Returned units:</span>
          <span className="font-semibold tabular-nums text-[var(--negative)]">{summary?.returned_units ?? 0}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">First purchase:</span>
          <span className="tabular-nums text-[var(--text)]">{summary?.first_purchase_date || '-'}</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)] hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-[11px]">Last purchase:</span>
          <span className="tabular-nums text-[var(--text)]">{summary?.last_purchase_date || '-'}</span>
        </div>
      </div>

      {/* One-row Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-[4px] p-2 text-xs print:hidden">
        {/* View Switch */}
        <div className="inline-flex items-center rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] p-0.5">
          <button
            onClick={() => {
              setView('lines');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded-[3px] transition-colors cursor-pointer ${
              view === 'lines'
                ? 'bg-[var(--card)] text-[var(--text)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Line items
          </button>
          <button
            onClick={() => {
              setView('products');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded-[3px] transition-colors cursor-pointer ${
              view === 'products'
                ? 'bg-[var(--card)] text-[var(--text)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            By product
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search SKU, product, invoice..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-2.5 py-1 text-xs rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2 py-1 text-xs rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
          <span className="text-[var(--text-muted)] text-[11px]">-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2 py-1 text-xs rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Product Filter */}
        <select
          value={productIdFilter}
          onChange={(e) => {
            setProductIdFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-2 py-1 text-xs rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer max-w-[140px]"
        >
          <option value="">All products</option>
          {distinctProductsList.map(p => (
            <option key={p.id || p.sku} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-2 py-1 text-xs rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          <option value="default">Active & returned</option>
          <option value="all">All orders</option>
          <option value="delivered">Delivered</option>
          <option value="in_progress">In progress</option>
          <option value="cancelled">Cancelled</option>
          <option value="rto">RTO</option>
        </select>

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

        {/* Action Buttons: Export Excel, PDF, Print, Columns */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleExportCsv}
            title="Export Excel (CSV)"
            className="p-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] text-[var(--text)] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleExportPdf}
            title="Export PDF"
            className="p-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] text-[var(--text)] cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handlePrint}
            title="Print"
            className="p-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] text-[var(--text)] cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Column Visibility Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu(prev => !prev)}
              title="Column visibility"
              className="p-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] text-[var(--text)] cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {showColMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--card)] border border-[var(--border)] rounded-[4px] p-2 shadow-md w-44 text-xs space-y-1">
                <div className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 pb-1 border-b border-[var(--border)]">
                  Toggle columns
                </div>
                {view === 'lines' ? (
                  <>
                    {['invoice', 'sku', 'unit_price', 'discount', 'status', 'channel', 'batch', ...(hasMixedSaleTypes ? ['sale_type'] : [])].map(col => (
                      <label key={col} className="flex items-center gap-2 cursor-pointer text-[var(--text)] capitalize">
                        <input
                          type="checkbox"
                          checked={!hiddenCols[col]}
                          onChange={() => toggleColumn(col)}
                          className="rounded border-[var(--border)] text-[var(--accent)]"
                        />
                        <span>{col.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </>
                ) : (
                  <>
                    {['sku', 'times_bought', 'units_bought', 'units_returned', 'avg_price', 'last_price', 'first_bought', 'last_bought'].map(col => (
                      <label key={col} className="flex items-center gap-2 cursor-pointer text-[var(--text)] capitalize">
                        <input
                          type="checkbox"
                          checked={!hiddenCols[col]}
                          onChange={() => toggleColumn(col)}
                          className="rounded border-[var(--border)] text-[var(--accent)]"
                        />
                        <span>{col.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[4px] overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[calc(100vh-270px)] relative">
          {view === 'lines' ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-[var(--surface-sunken)] shadow-xs">
                <tr className="border-b border-[var(--border)] text-[11px] font-medium text-[var(--text-muted)]">
                  <th className="sticky left-0 z-30 bg-[var(--surface-sunken)] py-2 px-3 whitespace-nowrap border-r border-[var(--border)]">
                    Date
                  </th>
                  {!hiddenCols.invoice && <th className="py-2 px-3 whitespace-nowrap">Invoice</th>}
                  {!hiddenCols.sku && <th className="py-2 px-3 whitespace-nowrap">SKU</th>}
                  <th className="py-2 px-3 whitespace-nowrap">Product</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">Qty</th>
                  {!hiddenCols.unit_price && <th className="py-2 px-3 text-right whitespace-nowrap">Unit price</th>}
                  {!hiddenCols.discount && <th className="py-2 px-3 text-right whitespace-nowrap">Discount</th>}
                  <th className="py-2 px-3 text-right whitespace-nowrap">Line total</th>
                  {!hiddenCols.status && <th className="py-2 px-3 whitespace-nowrap">Status</th>}
                  {!hiddenCols.channel && <th className="py-2 px-3 whitespace-nowrap">Channel</th>}
                  {!hiddenCols.batch && <th className="py-2 px-3 whitespace-nowrap">Batch</th>}
                  {hasMixedSaleTypes && !hiddenCols.sale_type && <th className="py-2 px-3 whitespace-nowrap">Sale type</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      No items found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  lines.map(row => {
                    const isSelected = selectedRowId === row.id;
                    const isNegative = row.is_return || row.quantity < 0;

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedRowId(row.id)}
                        onDoubleClick={() => handleLineDoubleClick(row)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]'
                            : 'odd:bg-[var(--card)] even:bg-[var(--surface-sunken)]/40 hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-inherit py-1.5 px-3 whitespace-nowrap border-r border-[var(--border)] tabular-nums text-[var(--text-muted)]">
                          {row.sale_date ? row.sale_date.slice(0, 10) : '-'}
                        </td>
                        {!hiddenCols.invoice && (
                          <td className="py-1.5 px-3 whitespace-nowrap font-medium text-[var(--accent)]">
                            {row.invoice_number}
                          </td>
                        )}
                        {!hiddenCols.sku && (
                          <td className="py-1.5 px-3 whitespace-nowrap text-[var(--text-muted)]">
                            {row.sku}
                          </td>
                        )}
                        <td className="py-1.5 px-3 whitespace-nowrap text-[var(--text)] font-medium">
                          {row.product_name}
                        </td>
                        <td className={`py-1.5 px-3 text-right whitespace-nowrap tabular-nums font-medium ${isNegative ? 'text-[var(--negative)]' : 'text-[var(--text)]'}`}>
                          {row.quantity}
                        </td>
                        {!hiddenCols.unit_price && (
                          <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums text-[var(--text)]">
                            ৳{row.unit_price.toLocaleString()}
                          </td>
                        )}
                        {!hiddenCols.discount && (
                          <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums text-[var(--text-muted)]">
                            {row.discount_amount > 0 ? `৳${row.discount_amount.toLocaleString()}` : '—'}
                          </td>
                        )}
                        <td className={`py-1.5 px-3 text-right whitespace-nowrap tabular-nums font-medium ${isNegative ? 'text-[var(--negative)]' : 'text-[var(--text)]'}`}>
                          ৳{row.total_price.toLocaleString()}
                        </td>
                        {!hiddenCols.status && (
                          <td className="py-1.5 px-3 whitespace-nowrap text-xs">
                            <span className={isNegative ? 'text-[var(--negative)]' : 'text-[var(--text)]'}>
                              {row.status}
                            </span>
                          </td>
                        )}
                        {!hiddenCols.channel && (
                          <td className="py-1.5 px-3 whitespace-nowrap text-[var(--text-muted)]">
                            {row.channel}
                          </td>
                        )}
                        {!hiddenCols.batch && (
                          <td className="py-1.5 px-3 whitespace-nowrap text-[var(--text-muted)]">
                            {row.batch_code || '—'}
                          </td>
                        )}
                        {hasMixedSaleTypes && !hiddenCols.sale_type && (
                          <td className="py-1.5 px-3 whitespace-nowrap text-[var(--text-muted)]">
                            {row.sale_type}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Footer Row */}
              <tfoot className="sticky bottom-0 bg-[var(--surface-sunken)] border-t border-[var(--border)] font-semibold text-xs">
                <tr>
                  <td className="sticky left-0 bg-[var(--surface-sunken)] py-2 px-3 border-r border-[var(--border)] text-[var(--text)]">
                    Total
                  </td>
                  {!hiddenCols.invoice && <td className="py-2 px-3" />}
                  {!hiddenCols.sku && <td className="py-2 px-3" />}
                  <td className="py-2 px-3 text-[var(--text-muted)]">
                    {summary?.line_items || 0} line items
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {summary?.net_units ?? 0}
                  </td>
                  {!hiddenCols.unit_price && <td className="py-2 px-3" />}
                  {!hiddenCols.discount && <td className="py-2 px-3" />}
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    ৳{(summary?.net_value ?? 0).toLocaleString()}
                  </td>
                  {!hiddenCols.status && <td className="py-2 px-3" />}
                  {!hiddenCols.channel && <td className="py-2 px-3" />}
                  {!hiddenCols.batch && <td className="py-2 px-3" />}
                  {hasMixedSaleTypes && !hiddenCols.sale_type && <td className="py-2 px-3" />}
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-[var(--surface-sunken)] shadow-xs">
                <tr className="border-b border-[var(--border)] text-[11px] font-medium text-[var(--text-muted)]">
                  {!hiddenCols.sku && (
                    <th className="sticky left-0 z-30 bg-[var(--surface-sunken)] py-2 px-3 whitespace-nowrap border-r border-[var(--border)]">
                      SKU
                    </th>
                  )}
                  <th className="py-2 px-3 whitespace-nowrap">Product</th>
                  {!hiddenCols.times_bought && <th className="py-2 px-3 text-right whitespace-nowrap">Times bought</th>}
                  {!hiddenCols.units_bought && <th className="py-2 px-3 text-right whitespace-nowrap">Units</th>}
                  {!hiddenCols.units_returned && <th className="py-2 px-3 text-right whitespace-nowrap">Returned</th>}
                  <th className="py-2 px-3 text-right whitespace-nowrap">Net units</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">Net value</th>
                  {!hiddenCols.avg_price && <th className="py-2 px-3 text-right whitespace-nowrap">Avg price</th>}
                  {!hiddenCols.last_price && <th className="py-2 px-3 text-right whitespace-nowrap">Last price</th>}
                  {!hiddenCols.first_bought && <th className="py-2 px-3 whitespace-nowrap">First bought</th>}
                  {!hiddenCols.last_bought && <th className="py-2 px-3 whitespace-nowrap">Last bought</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      No products found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  products.map(prod => {
                    const isSelected = selectedRowId === prod.product_id;

                    return (
                      <tr
                        key={prod.product_id || prod.sku}
                        onClick={() => setSelectedRowId(prod.product_id)}
                        onDoubleClick={() => handleProductDoubleClick(prod)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]'
                            : 'odd:bg-[var(--card)] even:bg-[var(--surface-sunken)]/40 hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        {!hiddenCols.sku && (
                          <td className="sticky left-0 z-10 bg-inherit py-1.5 px-3 whitespace-nowrap border-r border-[var(--border)] font-medium text-[var(--text-muted)]">
                            {prod.sku}
                          </td>
                        )}
                        <td className="py-1.5 px-3 whitespace-nowrap text-[var(--text)] font-medium">
                          {prod.product_name}
                        </td>
                        {!hiddenCols.times_bought && (
                          <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums text-[var(--text)]">
                            {prod.times_bought}
                          </td>
                        )}
                        {!hiddenCols.units_bought && (
                          <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums text-[var(--text)]">
                            {prod.units_bought}
                          </td>
                        )}
                        {!hiddenCols.units_returned && (
                          <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums text-[var(--negative)]">
                            {prod.units_returned > 0 ? prod.units_returned : '—'}
                          </td>
                        )}
                        <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums font-semibold text-[var(--text)]">
                          {prod.net_units}
                        </td>
                        <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums font-semibold text-[var(--text)]">
                          ৳{prod.net_value.toLocaleString()}
                        </td>
                        {!hiddenCols.avg_price && (
                          <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums text-[var(--text-muted)]">
                            ৳{prod.average_unit_price.toLocaleString()}
                          </td>
                        )}
                        {!hiddenCols.last_price && (
                          <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums text-[var(--text)]">
                            ৳{prod.last_unit_price.toLocaleString()}
                          </td>
                        )}
                        {!hiddenCols.first_bought && (
                          <td className="py-1.5 px-3 whitespace-nowrap tabular-nums text-[var(--text-muted)]">
                            {prod.first_bought}
                          </td>
                        )}
                        {!hiddenCols.last_bought && (
                          <td className="py-1.5 px-3 whitespace-nowrap tabular-nums text-[var(--text-muted)]">
                            {prod.last_bought}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Footer Row */}
              <tfoot className="sticky bottom-0 bg-[var(--surface-sunken)] border-t border-[var(--border)] font-semibold text-xs">
                <tr>
                  {!hiddenCols.sku && (
                    <td className="sticky left-0 bg-[var(--surface-sunken)] py-2 px-3 border-r border-[var(--border)] text-[var(--text)]">
                      Total
                    </td>
                  )}
                  <td className="py-2 px-3 text-[var(--text-muted)]">
                    {summary?.distinct_products || 0} products
                  </td>
                  {!hiddenCols.times_bought && <td className="py-2 px-3" />}
                  {!hiddenCols.units_bought && <td className="py-2 px-3" />}
                  {!hiddenCols.units_returned && (
                    <td className="py-2 px-3 text-right tabular-nums text-[var(--negative)]">
                      {summary?.returned_units || 0}
                    </td>
                  )}
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    {summary?.net_units ?? 0}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text)]">
                    ৳{(summary?.net_value ?? 0).toLocaleString()}
                  </td>
                  {!hiddenCols.avg_price && <td className="py-2 px-3" />}
                  {!hiddenCols.last_price && <td className="py-2 px-3" />}
                  {!hiddenCols.first_bought && <td className="py-2 px-3" />}
                  {!hiddenCols.last_bought && <td className="py-2 px-3" />}
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Numbered Pagination */}
        {totalCount > 0 && (
          <div className="p-2.5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs bg-[var(--surface-sunken)] print:hidden">
            <div className="text-[var(--text-muted)]">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} {view === 'lines' ? 'items' : 'products'}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] text-[var(--text)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                if (totalPages > 7) {
                  if (pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
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
                      currentPage === pageNum
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
                disabled={currentPage >= totalPages}
                className="p-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] text-[var(--text)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
