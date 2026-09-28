import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Package,
  Boxes,
  Upload,
  Warehouse,
  ArrowDownUp,
  Barcode,
  X,
  Check,
  AlertTriangle,
  Sparkles,
  Layers,
  Save,
  ShoppingBag,
  Boxes as BundleIcon,
  Hash,
  Tag,
  Type,
  Users,
  Trash2,
  ChevronDown,
  RotateCcw,
  StickyNote,
  SlidersHorizontal,
  PencilLine,
  History,
  CalendarDays,
  CheckSquare,
  FileDown,
  Printer,
  ListPlus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Product, PerfumeConcentration, PerfumeType, ProductBatch, StockMovement } from '../../types';
import { PageHeader } from '../common/PageHeader';
import { Modal } from '../common/Modal';
import { ProductSalesHistoryTab } from './ProductSalesHistoryTab';
import { jsPDF } from 'jspdf';


const PERFUME_TYPES: PerfumeType[] = ['Middle Eastern', 'Western', 'Niche'];
// Primary origin/type options shown first, more prominently, in the Type
// filter. This is a filter-ordering concern only \u2014 'Designer' is included so
// it surfaces at the top even though it may not exist in data yet.
const PRIMARY_PERFUME_TYPES = ['Middle Eastern', 'Niche', 'Designer', 'Western'] as PerfumeType[];
const CONCENTRATIONS: PerfumeConcentration[] = ['EDP', 'EDT', 'Extrait', 'Parfum', 'Cologne', 'Attar', 'Concentrated Oil'];
const GENDERS = ['Men', 'Women', 'Unisex'] as const;

// Shared note autocomplete library. A single curated list keeps entry
// consistent across products; individual product notes are stored on the
// product itself (source of truth), this is only a convenience picker.
const NOTE_LIBRARY = [
  'Bergamot', 'Lemon', 'Orange', 'Grapefruit', 'Mandarin', 'Neroli', 'Lime', 'Yuzu',
  'Lavender', 'Rose', 'Jasmine', 'Geranium', 'Saffron', 'Cinnamon', 'Cardamom', 'Nutmeg',
  'Pink Pepper', 'Black Pepper', 'Oud', 'Sandalwood', 'Cedarwood', 'Vetiver', 'Patchouli', 'Agarwood',
  'Amber', 'Musk', 'Vanilla', 'Tonka Bean', 'Benzoin', 'Frankincense', 'Leather', 'Tobacco',
  'Apple', 'Pear', 'Peach', 'Blackcurrant', 'Pineapple', 'Coconut', 'Watermelon', 'Sea Salt',
  'Ambergris', 'Cashmeran', 'Iris', 'Violet', 'Heliotrope', 'Coumarin', 'Civet', 'Aldehydes',
  'Green Leaves', 'Bamboo', 'Mint', 'Basil', 'Sage', 'Ginger', 'Fougere', 'Chypre',
];

// Association libraries for structured entry.
const TOP_LIBRARY = ['Bergamot', 'Lemon', 'Orange', 'Grapefruit', 'Mandarin', 'Neroli', 'Lime', 'Yuzu', 'Pink Pepper', 'Black Pepper', 'Green Leaves', 'Bamboo', 'Mint', 'Basil', 'Sage', 'Ginger', 'Aldehydes'];
const HEART_LIBRARY = ['Rose', 'Jasmine', 'Lavender', 'Geranium', 'Saffron', 'Cinnamon', 'Cardamom', 'Nutmeg', 'Iris', 'Violet', 'Heliotrope', 'Sea Salt', 'Apple', 'Pear', 'Peach', 'Blackcurrant', 'Pineapple', 'Coconut', 'Watermelon'];
const BASE_LIBRARY = ['Oud', 'Sandalwood', 'Cedarwood', 'Vetiver', 'Patchouli', 'Agarwood', 'Amber', 'Musk', 'Vanilla', 'Tonka Bean', 'Benzoin', 'Frankincense', 'Leather', 'Tobacco', 'Ambergris', 'Cashmeran'];
const ACCORD_LIBRARY = ['Coumarin', 'Civet', 'Aldehydes', 'Fougere', 'Chypre', 'Aromatic', 'Woody', 'Citrus', 'Sweet', 'Earthy', 'Spicy'];

interface ProductForm {
  brand: string;
  name: string;
  concentration: PerfumeConcentration;
  size_variant: string;
  category_name: string;
  gender?: 'Men' | 'Women' | 'Unisex';
  perfume_type: PerfumeType | '';
  sku: string;
  barcode: string;
  selling_price: string;
  wholesale_price: string;
  wholesale_type: 'same_as_retail' | 'separate';
  avg_cost: string;
  low_stock_threshold: string;
  photo_url: string;
  location_shop: string;
  location_main: string;
  gross_weight: string;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  main_accords: string[];
}

const emptyForm: ProductForm = {
  brand: '',
  name: '',
  concentration: 'EDP',
  size_variant: '100ML',
  category_name: 'General',
  gender: undefined,
  perfume_type: '',
  sku: '',
  barcode: '',
  selling_price: '',
  wholesale_price: '',
  wholesale_type: 'same_as_retail',
  avg_cost: '',
  low_stock_threshold: '3',
  photo_url: '',
  location_shop: '',
  location_main: '',
  gross_weight: '',
  top_notes: [],
  heart_notes: [],
  base_notes: [],
  main_accords: [],
};

export const ProductsView: React.FC = () => {
  const { products, receiveStock, setOpeningStock, createProduct, updateProduct, deleteProduct, importBulkCsv, refreshAll, settings, batches, stockMovements, warehouses } = useApp();
  const { can } = useAuth();

  // Normalize a product's effective wholesale rule (handles legacy rows missing
  // whistle_sale_type): 'separate' when a distinct lower wholesale price is
  // stored, otherwise 'same_as_retail'.
  const effectiveWholesaleType = (p: Product): 'same_as_retail' | 'separate' =>
    p.wholesale_type === 'separate' || p.wholesale_type === 'same_as_retail'
      ? p.wholesale_type
      : typeof p.wholesale_price === 'number' &&
        p.wholesale_price > 0 &&
        p.wholesale_price !== (p.selling_price ?? 0)
      ? 'separate'
      : 'same_as_retail';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [concentrationFilter, setConcentrationFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const moreFiltersRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [detailsProduct, setDetailsProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [notesPreviewProduct, setNotesPreviewProduct] = useState<Product | null>(null);

  // Selection Mode \u2014 an explicit, temporary bulk-selection state. No permanent
  // checkbox column: selection controls are only rendered while this is active.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastRangeAnchorId, setLastRangeAnchorId] = useState<string | null>(null);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const bulkMenuRef = useRef<HTMLDivElement>(null);
  const allCheckboxRef = useRef<HTMLInputElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteStep, setDeleteStep] = useState(0); // 0, 1, 2
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => p.category_name && set.add(p.category_name));
    return Array.from(set).sort();
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => p.brand && set.add(p.brand));
    return Array.from(set).sort();
  }, [products]);

  const sizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => p.size_variant && set.add(p.size_variant));
    return Array.from(set).sort((a, b) => {
      const an = parseInt(a.replace(/[^0-9]/g, '')) || 0;
      const bn = parseInt(b.replace(/[^0-9]/g, '')) || 0;
      return an - bn || a.localeCompare(b);
    });
  }, [products]);

  // More Filters popover: dismiss on click-anywhere-outside or Escape.
  useEffect(() => {
    if (!showMoreFilters) return;
    const onClick = (e: MouseEvent) => {
      if (moreFiltersRef.current && !moreFiltersRef.current.contains(e.target as Node)) {
        setShowMoreFilters(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMoreFilters(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showMoreFilters]);

  // Any filter/search active \u2192 show a compact "Clear filters" control.
  const anyFilterActive =
    searchQuery.trim() !== '' ||
    categoryFilter !== 'all' ||
    genderFilter !== 'all' ||
    typeFilter !== 'all' ||
    concentrationFilter !== 'all' ||
    brandFilter !== 'all' ||
    sizeFilter !== 'all' ||
    lowStockOnly;

  const clearAllFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setGenderFilter('all');
    setTypeFilter('all');
    setConcentrationFilter('all');
    setBrandFilter('all');
    setSizeFilter('all');
    setLowStockOnly(false);
  };

  // ---------------- Selection Mode helpers ----------------

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastRangeAnchorId(id);
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
    setLastRangeAnchorId(null);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setLastRangeAnchorId(null);
    setShowBulkMenu(false);
  };

  // Row handler: in Selection Mode, clicking toggles (with shift/ctrl/cmd).
  // Outside Selection Mode, a normal row click opens Product Details.
  const handleRowActivate = (e: React.MouseEvent, productId: string) => {
    if (!selectionMode) {
      const p = products.find(x => x.id === productId);
      if (p) setDetailsProduct(p);
      return;
    }
    if (e.shiftKey && lastRangeAnchorId) {
      // Continuous range between the last anchor and this row.
      const startIdx = filteredIds.indexOf(lastRangeAnchorId);
      const endIdx = filteredIds.indexOf(productId);
      if (startIdx >= 0 && endIdx >= 0) {
        const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        setSelectedIds(prev => {
          const next = new Set(prev);
          for (let i = lo; i <= hi; i++) next.add(filteredIds[i]);
          return next;
        });
      }
      return;
    }
    // ctrl/cmd click = non-contiguous individual toggle (no range anchor move).
    toggleSelect(productId);
  };

  // ESC exits Selection Mode \u2014 but only when no modal/popover owns the key.
  const exitSelectionModeRef = useRef(exitSelectionMode);
  exitSelectionModeRef.current = exitSelectionMode;
  const hasModalOpen = (detailsProduct || editingProduct || notesPreviewProduct || showMoreFilters || showBulkMenu || showAddModal || showReceiveModal || showOpeningModal || showBulkModal || showBundleModal || showDeleteModal) as boolean;
  const hasModalOpenRef = useRef(hasModalOpen);
  hasModalOpenRef.current = hasModalOpen;

  useEffect(() => {
    if (!selectionMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (hasModalOpenRef.current) return; // a modal/popover consumes ESC first
      setSelectionMode(false);
      setSelectedIds(new Set());
      setLastRangeAnchorId(null);
      setShowBulkMenu(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectionMode]);

  // Bulk menu: dismiss on click-anywhere-outside or Escape.
  useEffect(() => {
    if (!showBulkMenu) return;
    const onClick = (e: MouseEvent) => {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) {
        setShowBulkMenu(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowBulkMenu(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showBulkMenu]);

  const runBulkAction = (action: 'print' | 'pdf' | 'excel' | 'retail' | 'wholesale') => {
    setShowBulkMenu(false);
    const list = selectedProducts;
    if (list.length === 0) return;
    if (action === 'wholesale' && !canRevealWholesale) return; // permission gate
    if (action === 'print') printProductList(list);
    else if (action === 'pdf') exportProductPdf(list, false);
    else if (action === 'excel') exportProductCsv(list, false);
    else if (action === 'retail') exportProductPdf(list, true);
    else if (action === 'wholesale') exportWholesalePriceList(list);
  };

  // Price recently changed (within the configured highlight duration) \u2192 the
  // product is pinned to the top of the table and its whole row highlighted.
  const priceHighlightHours = settings?.price_highlight_duration_hours ?? 48;
  const isRecentlyRepriced = (p: Product) => {
    if (!p.price_updated_at) return false;
    const hours = (Date.now() - new Date(p.price_updated_at).getTime()) / 3600000;
    return hours >= 0 && hours <= priceHighlightHours;
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (categoryFilter !== 'all' && p.category_name !== categoryFilter) return false;
      if (genderFilter !== 'all' && p.gender !== genderFilter) return false;
      if (typeFilter !== 'all' && p.perfume_type !== typeFilter) return false;
      if (concentrationFilter !== 'all' && p.concentration !== concentrationFilter) return false;
      if (brandFilter !== 'all' && p.brand !== brandFilter) return false;
      if (sizeFilter !== 'all' && p.size_variant !== sizeFilter) return false;
      if (lowStockOnly) {
        const avail = p.stock_available ?? 0;
        if (avail >= (p.low_stock_threshold ?? 3)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const notes = [...(p.top_notes || []), ...(p.heart_notes || []), ...(p.base_notes || []), ...(p.main_accords || [])].join(' ');
        const hay = `${p.name} ${p.brand} ${p.sku} ${p.barcode} ${p.display_name} ${p.category_name || ''} ${p.perfume_type || ''} ${notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, categoryFilter, genderFilter, typeFilter, concentrationFilter, brandFilter, sizeFilter, lowStockOnly, searchQuery]);

  // Recently price-updated products are pinned to the top (newest first); all
  // other products keep their existing order below them.
  const orderedProducts = useMemo(() => {
    const recent: Product[] = [];
    const rest: Product[] = [];
    for (const p of filteredProducts) {
      if (isRecentlyRepriced(p)) recent.push(p);
      else rest.push(p);
    }
    recent.sort((a, b) => new Date(b.price_updated_at!).getTime() - new Date(a.price_updated_at!).getTime());
    return [...recent, ...rest];
  }, [filteredProducts, priceHighlightHours]);

  const filteredIds = useMemo(() => orderedProducts.map(p => p.id), [orderedProducts]);
  const selectedProducts = useMemo(
    () => products.filter(p => selectedIds.has(p.id)),
    [products, selectedIds]
  );
  const allVisibleSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));

  // Inventory summary \u2014 derived from live product stock data, never hardcoded.
  const inventorySummary = useMemo(() => {
    let onHand = 0;
    let shop = 0;
    let main = 0;
    for (const p of products) {
      for (const w of p.stock_by_warehouse ?? []) {
        onHand += w.on_hand;
        if (w.warehouse_id === 'wh_shop') shop += w.on_hand;
        else if (w.warehouse_id === 'wh_main') main += w.on_hand;
      }
    }
    return { totalSkus: products.length, onHand, shop, main };
  }, [products]);

  useEffect(() => {
    if (allCheckboxRef.current) {
      const someSelected = selectedIds.size > 0 && !allVisibleSelected;
      allCheckboxRef.current.indeterminate = someSelected;
    }
  }, [selectedIds, allVisibleSelected]);

  const getWhStock = (p: Product, whId: string) => {
    const rec = p.stock_by_warehouse?.find(w => w.warehouse_id === whId);
    return rec ? rec : { warehouse_id: whId, warehouse_name: '', on_hand: 0, reserved: 0, available: 0 };
  };

  // Point 1: wholesale price is masked by default. A single global
  // "Show Wholesale Prices" toggle near the table controls reveals the whole
  // column when ON (and the user holds the view_cost_margin capability).
  // Defaults to OFF on every screen open/refresh via component state.
  const [showWholesale, setShowWholesale] = useState(false);
  const canRevealWholesale = can('view_cost_margin');
  const wholesaleRevealed = showWholesale && canRevealWholesale;

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCreate = async (form: ProductForm) => {
    if (!form.brand.trim() || !form.name.trim() || !form.selling_price) {
      setErrorMsg('Brand, Name, and Selling Price are required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await createProduct({
        brand: form.brand.trim(),
        name: form.name.trim(),
        concentration: form.concentration,
        size_variant: form.size_variant.trim() || '100ML',
        category_name: form.category_name.trim() || 'General',
        gender: form.gender,
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        selling_price: Number(form.selling_price),
        wholesale_price: form.wholesale_type === 'separate' && form.wholesale_price ? Number(form.wholesale_price) : undefined,
        wholesale_type: form.wholesale_type,
        avg_cost: Number(form.avg_cost) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 3,
        photo_url: form.photo_url.trim(),
        location_shop: form.location_shop.trim() || undefined,
        location_main: form.location_main.trim() || undefined,
        perfume_type: form.perfume_type || undefined,
        top_notes: form.top_notes,
        heart_notes: form.heart_notes,
        base_notes: form.base_notes,
        main_accords: form.main_accords,
        gross_weight: form.gross_weight.trim() !== '' ? Number(form.gross_weight) : undefined,
        is_bundle: false,
      });
      setShowAddModal(false);
      showSuccess('Product created successfully.');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to create product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, form: ProductForm) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await updateProduct(id, {
        brand: form.brand.trim(),
        name: form.name.trim(),
        concentration: form.concentration,
        size_variant: form.size_variant.trim() || '100ML',
        category_name: form.category_name.trim() || 'General',
        gender: form.gender,
        selling_price: Number(form.selling_price),
        wholesale_price: form.wholesale_type === 'separate' && form.wholesale_price ? Number(form.wholesale_price) : undefined,
        wholesale_type: form.wholesale_type,
        low_stock_threshold: Number(form.low_stock_threshold) || 3,
        photo_url: form.photo_url.trim(),
        location_shop: form.location_shop.trim() || undefined,
        location_main: form.location_main.trim() || undefined,
        perfume_type: form.perfume_type || undefined,
        top_notes: form.top_notes,
        heart_notes: form.heart_notes,
        base_notes: form.base_notes,
        main_accords: form.main_accords,
        gross_weight: form.gross_weight.trim() !== '' ? Number(form.gross_weight) : undefined,
      });
      setEditingProduct(null);
      showSuccess('Product updated successfully.');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to update product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceive = async (data: any) => {
    if (!data.product_id || !data.qty_received || Number(data.qty_received) <= 0 || !data.landed_cost_per_unit) {
      setErrorMsg('All fields required with a positive quantity.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await receiveStock(data);
      setShowReceiveModal(false);
      showSuccess('Stock received successfully.');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to receive stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpening = async (data: any) => {
    if (!data.product_id || !data.quantity || Number(data.quantity) <= 0) {
      setErrorMsg('Product and positive quantity required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await setOpeningStock(data);
      setShowOpeningModal(false);
      showSuccess('Opening balance recorded.');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to record opening balance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulk = async (rows: any[]) => {
    if (!rows.length) {
      setErrorMsg('No rows to import.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const count = await importBulkCsv(rows);
      setShowBulkModal(false);
      showSuccess(`Imported ${count} products.`);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to import CSV.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteProduct(deleteTarget.id, deleteReason || 'No reason provided');
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setDeleteStep(0);
      setDeleteReason('');
      showSuccess(`${deleteTarget.display_name} deleted successfully.`);
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to delete product.');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Inventory"
        title="Products"
        desc={`${products.length} SKUs registered \u00B7 ${products.filter(p => (p.stock_available ?? 0) <= 0).length} out of stock \u00B7 ${products.filter(p => (p.stock_available ?? 0) > 0 && (p.stock_available ?? 0) <= (p.low_stock_threshold ?? 3)).length} low stock`}
        actions={
          <>
            <button
              onClick={() => (selectionMode ? exitSelectionMode() : enterSelectionMode())}
              className={selectionMode ? 'erp-btn-secondary' : 'erp-btn-secondary'}
              title={selectionMode ? 'Exit selection mode (ESC)' : 'Select multiple products for a bulk action'}
              style={selectionMode ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
            >
              {selectionMode ? <><X className="w-3.5 h-3.5" /> Cancel Select</> : <><CheckSquare className="w-3.5 h-3.5" /> Select</>}
            </button>
            <button onClick={() => { setShowReceiveModal(true); setEditingProduct(null); }} className="erp-btn-secondary">
              <ArrowDownUp className="w-3.5 h-3.5" /> Receive Stock
            </button>
            <button onClick={() => { setShowOpeningModal(true); setEditingProduct(null); }} className="erp-btn-secondary">
              <Warehouse className="w-3.5 h-3.5" /> Opening Balance
            </button>
            <button onClick={() => { setShowBulkModal(true); setEditingProduct(null); }} className="erp-btn-secondary">
              <Upload className="w-3.5 h-3.5" /> Bulk CSV
            </button>
            <button onClick={() => { setShowBundleModal(true); setEditingProduct(null); }} className="erp-btn-secondary">
              <BundleIcon className="w-3.5 h-3.5" /> Combo Bundle
            </button>
            <button onClick={() => { setShowAddModal(true); setEditingProduct(null); }} className="erp-btn-primary">
              <Plus className="w-3.5 h-3.5" /> Add SKU
            </button>
          </>
        }
      />

      {/* Selection Mode contextual strip */}
      {selectionMode && (
        <div className="flex flex-wrap items-center gap-2 border border-[var(--accent)] rounded-lg px-3 py-2 bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]">
          <button
            type="button"
            onClick={toggleSelectAllVisible}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent)] cursor-pointer hover:underline"
          >
            {allVisibleSelected ? <><X className="w-3.5 h-3.5" /> Deselect all</> : <><ListPlus className="w-3.5 h-3.5" /> Select all (filtered)</>}
          </button>
          <span className="text-[12px] font-semibold text-[var(--text)] font-num">
            {selectedIds.size} selected
          </span>

          {selectedIds.size > 0 && (
            <div className="relative" ref={bulkMenuRef}>
              <button
                type="button"
                onClick={() => setShowBulkMenu(s => !s)}
                className="erp-btn-primary inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5"
              >
                Bulk Actions <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBulkMenu ? 'rotate-180' : ''}`} />
              </button>
              {showBulkMenu && (
                <div className="absolute left-0 mt-1.5 z-40 w-60 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl py-1.5 animate-in fade-in duration-100">
                  <button type="button" onClick={() => runBulkAction('print')} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer">
                    <Printer className="w-4 h-4 text-[var(--text-muted)]" /> Print
                  </button>
                  <button type="button" onClick={() => runBulkAction('excel')} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer">
                    <FileDown className="w-4 h-4 text-[var(--text-muted)]" /> Export Excel (CSV)
                  </button>
                  <button type="button" onClick={() => runBulkAction('pdf')} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer">
                    <FileDown className="w-4 h-4 text-[var(--text-muted)]" /> Export PDF
                  </button>
                  <div className="my-1 border-t border-[var(--border)]" />
                  <button type="button" onClick={() => runBulkAction('retail')} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer">
                    <Tag className="w-4 h-4 text-[var(--text-muted)]" /> Retail Price List
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulkAction('wholesale')}
                    disabled={!canRevealWholesale}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer ${canRevealWholesale ? 'text-[var(--text)] hover:bg-[var(--surface-hover)]' : 'text-[var(--text-muted)] opacity-50 cursor-not-allowed'}`}
                    title={canRevealWholesale ? 'Generate wholesale price list for selected products' : 'View Cost/Margin permission required'}
                  >
                    <Tag className="w-4 h-4 text-[var(--text-muted)]" /> Wholesale Price List
                  </button>
                </div>
              )}
            </div>
          )}

          <span className="ml-auto text-[11px] text-[var(--text-muted)]">Shift+click for range &#183; Ctrl/Cmd+click for multi-pick &#183; Esc to exit</span>
        </div>
      )}


      {/* Success / Error messages */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[12px] font-semibold"
          style={{ background: 'color-mix(in srgb, var(--status-green) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--status-green) 25%, transparent)', color: 'var(--status-green)' }}>
          <Check className="w-3.5 h-3.5 shrink-0" /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[12px] font-semibold"
          style={{ background: 'color-mix(in srgb, var(--status-red) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--status-red) 25%, transparent)', color: 'var(--status-red)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Name, brand, SKU, barcode..."
            className="erp-input pl-8 w-64"
          />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="erp-select">
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)} className="erp-select" title="Filter by gender">
          <option value="all">Gender</option>
          {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="erp-select" title="Type / origin">
          <option value="all">All Types</option>
          {PRIMARY_PERFUME_TYPES.map(t => <option key={t} value={t} className="font-semibold">{t}</option>)}
          {(() => {
            const secondary = Array.from(new Set(
              products.map(p => p.perfume_type).filter((t): t is PerfumeType => !!t)
                .filter(t => !PRIMARY_PERFUME_TYPES.includes(t))
            )).sort();
            return secondary.map(t => <option key={t} value={t}>{t}</option>);
          })()}
        </select>
        <select value={concentrationFilter} onChange={e => setConcentrationFilter(e.target.value)} className="erp-select">
          <option value="all">All Concentrations</option>
          {CONCENTRATIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* More Filters popover: brand, size, low-stock */}
        <div className="relative" ref={moreFiltersRef}>
          <button
            type="button"
            onClick={() => setShowMoreFilters(s => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] cursor-pointer"
            title={brandFilter !== 'all' || sizeFilter !== 'all' || lowStockOnly ? 'Filters active' : 'More filters'}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> More Filters
            {(brandFilter !== 'all' || sizeFilter !== 'all' || lowStockOnly) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-amber)]" />
            )}
          </button>
          {showMoreFilters && (
            <div className="absolute left-0 mt-2 z-50 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-3 space-y-3 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => setShowMoreFilters(false)}
                className="absolute top-2 right-2 p-1 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Brand</label>
                <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="erp-select w-full">
                  <option value="all">All Brands</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Size</label>
                <select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className="erp-select w-full">
                  <option value="all">All Sizes</option>
                  {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] cursor-pointer select-none pt-1 border-t border-[var(--border)]">
                <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} className="rounded" />
                Low stock only
              </label>
            </div>
          )}
        </div>

        <label
          className={`inline-flex items-center gap-1.5 text-[12px] cursor-pointer select-none ${canRevealWholesale ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)] opacity-60'}`}
          title={canRevealWholesale ? 'Reveal wholesale prices for all rows' : 'Wholesale prices restricted (View Cost/Margin required)'}
        >
          <input
            type="checkbox"
            checked={showWholesale}
            disabled={!canRevealWholesale}
            onChange={e => setShowWholesale(e.target.checked)}
            className="rounded"
          />
          Show Wholesale Prices
        </label>
        {anyFilterActive && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--status-red)] cursor-pointer"
            title="Clear all filters and search"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
        <span className="ml-auto text-[11px] text-[var(--text-muted)] font-num">
          {filteredProducts.length} of {products.length} SKUs
        </span>
      </div>

      {/* Product table */}
      <div className="dense-table-container">
        <div className="overflow-x-auto">
          <table className="dense-table">
            <thead>
              <tr>
                {selectionMode && (
                  <th className="w-8 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={allCheckboxRef}
                      onChange={toggleSelectAllVisible}
                      className="rounded"
                      aria-label="Select all visible products"
                    />
                  </th>
                )}
                <th>SKU</th>
                <th>Brand</th>
                <th>Product Name</th>
                <th>Concentration</th>
                <th>Size</th>
                <th>Gender</th>
                <th>Barcode</th>
                <th className="text-right">Shop Floor</th>
                <th className="text-right">Main Store</th>
                <th className="text-right">Reserved</th>
                <th className="text-right">Available</th>
                {can('view_cost_margin') && <th className="text-right">Cost</th>}
                <th className="text-right">Price</th>
                <th className="text-right">Wholesale</th>
                {can('view_cost_margin') && <th className="text-right">Margin</th>}
                <th>Type</th>
                <th className="text-center">Notes</th>
              </tr>
            </thead>
            <tbody>
              {orderedProducts.map(p => {
                const shop = getWhStock(p, 'wh_shop');
                const main = getWhStock(p, 'wh_main');
                const avail = p.stock_available ?? 0;
                const isOutOfStock = avail <= 0;
                const isLowStock = !isOutOfStock && avail <= (p.low_stock_threshold ?? 3);
                const margin = p.avg_cost && p.selling_price
                  ? Math.round(((p.selling_price - p.avg_cost) / p.selling_price) * 100)
                  : null;
                return (
                  <tr
                    key={p.id}
                    tabIndex={0}
                    onClick={e => handleRowActivate(e, p.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (selectionMode) {
                          e.preventDefault();
                          toggleSelect(p.id);
                        } else {
                          setDetailsProduct(p);
                        }
                      }
                    }}
                    aria-selected={selectionMode ? selectedIds.has(p.id) : undefined}
                    className={`dense-table-row-clickable ${selectionMode && selectedIds.has(p.id) ? 'bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] outline outline-1 outline-[var(--accent)]' : ''} ${!selectionMode && isRecentlyRepriced(p) ? 'bg-[color-mix(in_srgb,var(--accent-secondary)_10%,transparent)]' : !selectionMode && isLowStock ? 'bg-[color-mix(in_srgb,var(--status-amber)_4%,transparent)]' : ''} cursor-pointer`}
                  >
                    {selectionMode && (
                      <td className="text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          onClick={e => e.stopPropagation()}
                          className="rounded"
                          aria-label={`Select ${p.display_name}`}
                        />
                      </td>
                    )}
                    <td className="font-num font-semibold text-[var(--accent)]">{p.sku}</td>
                    <td className="text-[var(--text-muted)]">{p.brand}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-[var(--surface-sunken)] flex items-center justify-center shrink-0">
                            <Package className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--text)] truncate max-w-[200px]">{p.name || p.display_name}</div>
                          {p.is_bundle && <div className="text-[10px] text-[var(--accent-secondary)] font-semibold truncate">Bundle</div>}
                        </div>
                      </div>
                    </td>
                    <td className="text-[var(--text-secondary)]">{p.concentration}</td>
                    <td className="font-num text-[var(--text-secondary)]">{p.size_variant || '\u2014'}</td>
                    <td>
                      {p.gender ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
                          {p.gender}
                        </span>
                      ) : '\u2014'}
                    </td>
                    <td className="font-num text-[var(--text-muted)] text-[10px]">{p.barcode}</td>
                    <td className="text-right font-num">{shop.on_hand}</td>
                    <td className="text-right font-num">{main.on_hand}</td>
                    <td className="text-right font-num text-[var(--status-amber)]">{p.stock_reserved ?? 0}</td>
                    <td className="text-right">
                      {isOutOfStock ? (
                        <span className="pill-red inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border">0 out</span>
                      ) : isLowStock ? (
                        <span className="pill-amber inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border">{avail} low</span>
                      ) : (
                        <span className="font-num font-semibold text-[var(--status-green)]">{avail}</span>
                      )}
                    </td>
                    {can('view_cost_margin') && (
                      <td className="text-right font-num text-[var(--text-muted)]">&#2547;{(p.avg_cost ?? 0).toLocaleString()}</td>
                    )}
                    <td className="text-right font-num font-semibold text-[var(--text)]">
                      &#2547;{(p.selling_price ?? 0).toLocaleString()}
                    </td>
                    <td className="text-right font-num" onClick={e => e.stopPropagation()}>
                      {p.wholesale_price !== undefined && p.wholesale_price !== null ? (
                        wholesaleRevealed ? (
                          <span className="inline-flex items-center rounded-full bg-[var(--accent)] text-white px-2 py-0.5 text-[10px] font-bold">
                            &#2547;{(p.wholesale_price).toLocaleString()}
                          </span>
                        ) : (
                          <span className="font-num tracking-widest text-[var(--text-muted)]">&#2547;&#8226;&#8226;&#8226;&#8226;</span>
                        )
                      ) : (
                        <span className="text-[var(--text-muted)] opacity-50">&#8212;</span>
                      )}
                    </td>
                    {can('view_cost_margin') && (
                      <td className="text-right font-num">
                        {margin !== null ? (
                          <span className={margin >= 30 ? 'status-green font-semibold' : margin >= 15 ? 'status-amber font-semibold' : 'status-red font-semibold'}>
                            {margin}%
                          </span>
                        ) : '\u2014'}
                      </td>
                    )}
                    <td>
                      {p.perfume_type ? (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap"
                          style={{
                            color: 'var(--accent)',
                            borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
                            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                          }}
                        >
                          {p.perfume_type}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] opacity-50">&#8212;</span>
                      )}
                    </td>
                    <td className="text-center" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Fragrance notes"
                        onClick={() => setNotesPreviewProduct(p)}
                        className="inline-flex items-center justify-center p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] cursor-pointer"
                      >
                        <StickyNote className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={15 + (can('view_cost_margin') ? 2 : 0) + (selectionMode ? 1 : 0)} className="px-4 py-12 text-center text-[var(--text-muted)]">
                    No products match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-[11px] text-[var(--text-muted)] border-t border-[var(--border)] font-num">
          Showing {filteredProducts.length} of {products.length} SKUs
        </div>
      </div>

      {/* Inventory summary footer */}
      <div className="mt-3 border-t border-[var(--border)] pt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12px] text-[var(--text-secondary)]">
        <span><span className="font-bold text-[var(--text)]">{inventorySummary.totalSkus}</span> SKUs</span>
        <span><span className="font-bold text-[var(--accent)] text-[15px]">{inventorySummary.onHand.toLocaleString()}</span> Units in Stock</span>
        <span>Shop Floor <span className="font-bold text-[var(--text)]">{inventorySummary.shop.toLocaleString()}</span></span>
        <span>Main Store <span className="font-bold text-[var(--text)]">{inventorySummary.main.toLocaleString()}</span></span>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <ProductModal
          title="Add New SKU"
          form={emptyForm}
          onClose={() => setShowAddModal(false)}
          onSubmit={form => handleCreate(form)}
          canEdit={can('create_edit_products') || can('edit_product_prices')}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && !showAddModal && !showBundleModal && !showReceiveModal && !showOpeningModal && !showBulkModal && (
        <ProductModal
          title={`Edit: ${editingProduct.sku}`}
          form={{
            brand: editingProduct.brand,
            name: editingProduct.name,
            concentration: editingProduct.concentration,
            size_variant: editingProduct.size_variant,
            category_name: editingProduct.category_name || 'General',
            gender: editingProduct.gender,
            perfume_type: editingProduct.perfume_type || '',
            sku: editingProduct.sku,
            barcode: editingProduct.barcode,
            selling_price: String(editingProduct.selling_price ?? ''),
            wholesale_price: editingProduct.wholesale_price !== undefined && editingProduct.wholesale_price !== null ? String(editingProduct.wholesale_price) : '',
            wholesale_type: effectiveWholesaleType(editingProduct),
            avg_cost: String(editingProduct.avg_cost ?? ''),
            low_stock_threshold: String(editingProduct.low_stock_threshold ?? '3'),
            photo_url: editingProduct.photo_url || '',
            location_shop: editingProduct.location_shop || '',
            location_main: editingProduct.location_main || '',
            gross_weight: editingProduct.gross_weight !== undefined && editingProduct.gross_weight !== null ? String(editingProduct.gross_weight) : '',
            top_notes: editingProduct.top_notes || [],
            heart_notes: editingProduct.heart_notes || [],
            base_notes: editingProduct.base_notes || [],
            main_accords: editingProduct.main_accords || [],
          }}
          onClose={() => setEditingProduct(null)}
          onSubmit={form => handleUpdate(editingProduct.id, form)}
          canEdit={can('create_edit_products') || can('edit_product_prices')}
          isSubmitting={isSubmitting}
          isExisting
          onDelete={() => {
            setDeleteTarget(editingProduct);
            setDeleteStep(0);
            setDeleteReason('');
            setDeleteError(null);
            setShowDeleteModal(true);
          }}
        />
      )}

      {/* Receive Stock Modal */}
      {showReceiveModal && (
        <ReceiveModal products={products} onClose={() => setShowReceiveModal(false)} onSubmit={handleReceive} isSubmitting={isSubmitting} />
      )}

      {/* Opening Balance Modal */}
      {showOpeningModal && (
        <OpeningModal products={products} onClose={() => setShowOpeningModal(false)} onSubmit={handleOpening} isSubmitting={isSubmitting} />
      )}

      {/* Bulk CSV Modal */}
      {showBulkModal && (
        <BulkModal onClose={() => setShowBulkModal(false)} onSubmit={handleBulk} isSubmitting={isSubmitting} />
      )}

      {/* Bundle Modal */}
      {showBundleModal && (
        <BundleBuilderModal products={products} onClose={() => setShowBundleModal(false)} onCreate={createProduct} refreshAll={refreshAll} isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} setErrorMsg={setErrorMsg} showSuccess={showSuccess} />
      )}

      {/* Delete Confirmation Modal (triple warning) */}
      {showDeleteModal && deleteTarget && (
        <DeleteConfirmModal
          product={deleteTarget}
          step={deleteStep}
          reason={deleteReason}
          error={deleteError}
          onStep={setDeleteStep}
          onReason={setDeleteReason}
          onCancel={() => {
            setShowDeleteModal(false);
            setDeleteTarget(null);
            setDeleteStep(0);
            setDeleteReason('');
            setDeleteError(null);
          }}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Fragrance Notes Quick Preview */}
      {notesPreviewProduct && (
        <NotesPreviewModal product={notesPreviewProduct} onClose={() => setNotesPreviewProduct(null)} />
      )}

      {/* Product Details Workspace (read-first) */}
      {detailsProduct && !editingProduct && (
        <ProductDetailsModal
          product={detailsProduct}
          batches={batches.filter(b => b.product_id === detailsProduct.id)}
          movements={stockMovements.filter(m => m.product_id === detailsProduct.id)}
          canEdit={can('create_edit_products') || can('edit_product_prices')}
          onClose={() => setDetailsProduct(null)}
          onEdit={() => {
            setEditingProduct(detailsProduct);
            setDetailsProduct(null);
          }}
        />
      )}
    </div>
  );
};

/* -------------------- Product Add/Edit Modal -------------------- */
const ProductModal: React.FC<{
  title: string;
  form: ProductForm;
  onClose: () => void;
  onSubmit: (form: ProductForm) => void;
  canEdit: boolean;
  isSubmitting: boolean;
  onDelete?: () => void;
  isExisting?: boolean;
}> = ({ title, form: initialForm, onClose, onSubmit, canEdit, isSubmitting, onDelete, isExisting }) => {
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const set = (k: keyof ProductForm, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-[var(--card)] w-full sm:max-w-2xl lg:max-w-4xl rounded-xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] shrink-0">
          <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)]"><X className="w-5 h-5" /></button>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!canEdit) { setConfirmMsg('You do not have permission to save product changes.'); return; }
            onSubmit(form);
          }}
          className="flex flex-col min-h-0"
        >
          <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">
            {/* Identity banner */}
            <div className="flex items-center gap-3">
              {form.photo_url ? (
                <img src={form.photo_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-[var(--border)]" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-[var(--surface-sunken)] flex items-center justify-center shrink-0 border border-[var(--border)]">
                  <Package className="w-6 h-6 text-[var(--text-muted)]" />
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text)] text-base leading-tight break-words">
                  {form.brand && form.name
                    ? `${form.brand} ${form.name} ${form.concentration || ''} ${form.size_variant || ''}`.trim()
                    : 'New product'}
                </div>
                {form.sku && <div className="text-[11px] text-[var(--text-secondary)] font-num mt-0.5">{form.sku}</div>}
              </div>
            </div>

            {/* PRIMARY INFORMATION */}
            <div>
              <SectionHeading>Primary Information</SectionHeading>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Brand" icon={<Tag className="w-3.5 h-3.5" />}>
                    <input required value={form.brand} onChange={e => set('brand', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Perfume Name (short)" icon={<Type className="w-3.5 h-3.5" />}>
                    <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Concentration">
                    <select value={form.concentration} onChange={e => set('concentration', e.target.value)} className={inputCls}>
                      {CONCENTRATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Size (e.g. 100ML)">
                    <input value={form.size_variant} onChange={e => set('size_variant', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Gender">
                    <select value={form.gender || ''} onChange={e => set('gender', e.target.value || undefined)} className={inputCls}>
                      <option value="">&#8212;</option>
                      {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Category">
                    <input value={form.category_name} onChange={e => set('category_name', e.target.value)} className={inputCls} placeholder="e.g. Amber Gourmand" />
                  </Field>
                  <Field label="Perfume Type">
                    <select value={form.perfume_type} onChange={e => set('perfume_type', e.target.value)} className={inputCls}>
                      <option value="">&#8212;</option>
                      {PERFUME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Barcode">
                    <input value={form.barcode} onChange={e => set('barcode', e.target.value)} className={inputCls} placeholder="Manufacturer or auto" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="SKU (e.g. KDL006)">
                    <input value={form.sku} onChange={e => set('sku', e.target.value)} className={inputCls} placeholder="Auto-generated if blank" />
                  </Field>
                </div>
              </div>
            </div>

            {/* PRICING */}
            <div>
              <SectionHeading>Pricing</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Selling Price (&#2547;)">
                  <input type="number" required min="0" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Cost (&#2547;)">
                  <input type="number" min="0" value={form.avg_cost} onChange={e => set('avg_cost', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Low-Stock Threshold">
                  <input type="number" min="0" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Wholesale Pricing">
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => set('wholesale_type', 'same_as_retail')}
                        className={`p-2 rounded-lg border font-semibold cursor-pointer ${
                          form.wholesale_type === 'same_as_retail'
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                        }`}
                        title="Wholesale customers pay the same price as retail."
                      >
                        Same as Retail
                      </button>
                      <button
                        type="button"
                        onClick={() => set('wholesale_type', 'separate')}
                        className={`p-2 rounded-lg border font-semibold cursor-pointer ${
                          form.wholesale_type === 'separate'
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                        }`}
                        title="Wholesale customers pay a separate wholesale price."
                      >
                        Separate Price
                      </button>
                    </div>
                    {form.wholesale_type === 'separate' ? (
                      <input
                        type="number"
                        min="0"
                        required
                        value={form.wholesale_price}
                        onChange={e => set('wholesale_price', e.target.value)}
                        className={inputCls}
                        placeholder="Wholesale price (&#2547;) &#8212; required"
                      />
                    ) : (
                      <div className="text-[11px] text-[var(--text-secondary)] px-1">
                        Wholesale = Retail (&#2547;{form.selling_price ? Number(form.selling_price).toLocaleString() : '\u2014'}) automatically.
                      </div>
                    )}
                  </div>
                </Field>
              </div>
            </div>

            {/* FRAGRANCE NOTES */}
            <div>
              <button
                type="button"
                onClick={() => setShowNotes(s => !s)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--accent)] cursor-pointer"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNotes ? 'rotate-180' : ''}`} />
                Fragrance Notes
              </button>
              {showNotes && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 border border-[var(--border)] rounded-lg p-4 bg-[var(--surface-sunken)]">
                  <NoteChipField label="Top Notes" value={form.top_notes} library={TOP_LIBRARY} onChange={v => set('top_notes', v)} placeholder="e.g. Bergamot" />
                  <NoteChipField label="Heart Notes" value={form.heart_notes} library={HEART_LIBRARY} onChange={v => set('heart_notes', v)} placeholder="e.g. Rose" />
                  <NoteChipField label="Base Notes" value={form.base_notes} library={BASE_LIBRARY} onChange={v => set('base_notes', v)} placeholder="e.g. Oud" />
                  <NoteChipField label="Main Accords" value={form.main_accords} library={ACCORD_LIBRARY} onChange={v => set('main_accords', v)} placeholder="e.g. Amber" />
                </div>
              )}
            </div>

            {/* ADVANCED DETAILS */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(s => !s)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--accent)] cursor-pointer"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                Advanced Details
              </button>
              {showAdvanced && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 border border-[var(--border)] rounded-lg p-4 bg-[var(--surface-sunken)]">
                  <Field label="Shop Floor Location">
                    <input value={form.location_shop} onChange={e => set('location_shop', e.target.value)} className={inputCls} placeholder="e.g. A-03" />
                  </Field>
                  <Field label="Main Store Location">
                    <input value={form.location_main} onChange={e => set('location_main', e.target.value)} className={inputCls} placeholder="e.g. B-02" />
                  </Field>
                  <Field label="Gross Weight (grams)">
                    <input
                      value={form.gross_weight}
                      onChange={e => set('gross_weight', e.target.value.replace(/[^0-9]/g, ''))}
                      className={inputCls}
                      placeholder="e.g. 250"
                      inputMode="numeric"
                    />
                  </Field>
                  <div className="sm:col-span-1">
                    <Field label="Photo URL">
                      <input value={form.photo_url} onChange={e => set('photo_url', e.target.value)} className={inputCls} placeholder="https://..." />
                    </Field>
                  </div>
                  <div className="sm:col-span-1 flex items-end">
                    <p className="text-[11px] text-[var(--text-muted)]">Gross weight = complete unit, bottle + box.</p>
                  </div>
                </div>
              )}
            </div>

            {confirmMsg && <div className="px-3 py-2 rounded-lg pill-amber text-sm">{confirmMsg}</div>}
          </div>

          <div className="flex justify-between items-center gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-sunken)] shrink-0">
            <div>
              {isExisting && onDelete && canEdit && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[color-mix(in_srgb,var(--status-red)_28%,transparent)] text-sm font-medium text-[var(--status-red)] hover:bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)]"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text)]">Cancel</button>
              <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--accent)] disabled:opacity-50" disabled={isSubmitting}>
                <Save className="w-4 h-4" /> {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* -------------------- Fragrance Notes Quick Preview -------------------- */
/* -------------------- Product Details Workspace --------------------
   Read-first modal opened by clicking a Products table row. Shows the
   large image, identity, fragrance notes, per-warehouse inventory &
   location, pricing, and real persisted history (created / first
   received / latest received / batches / recent movements). Editing
   is an explicit, separate action (the "Edit Product" button), not
   the row-click default.
-------------------------------------------------------------------- */
const ProductDetailsModal: React.FC<{
  product: Product;
  batches: ProductBatch[];
  movements: StockMovement[];
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
}> = ({ product, batches, movements, canEdit, onClose, onEdit }) => {
  const [tab, setTab] = useState<'overview' | 'sales' | 'batches' | 'history'>('overview');

  // Real stock-in events (receiving / opening balance / restock). Sales,
  // transfers out, damage, etc. are not "received" events and are excluded,
  // so the dates stay meaningful about when stock actually arrived.
  const stockInReasons: StockMovement['movement_reason'][] = [
    'PURCHASE',
    'PO_RECEIVING',
    'OPENING_BALANCE',
    'RETURN_RESTOCK',
  ];
  const inbound = useMemo(
    () => movements.filter(m => m.quantity_delta > 0 && stockInReasons.includes(m.movement_reason)),
    [movements]
  );
  const sortedInbound = useMemo(
    () => [...inbound].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [inbound]
  );
  const firstReceived = sortedInbound[0]?.created_at;
  const latestReceived = sortedInbound[sortedInbound.length - 1]?.created_at;

  const fmtDate = (iso?: string) => {
    if (!iso) return null;
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
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

  const fmtMoney = (n: number | undefined | null) =>
    n === undefined || n === null || isNaN(n)
      ? '\u2014'
      : '\u09F3' + n.toLocaleString('en-US');

  const stockAgeLabel = firstReceived
    ? (() => {
        const days = Math.max(0, Math.floor((Date.now() - new Date(firstReceived).getTime()) / 86400000));
        return days === 0 ? 'Less than a day' : `${days} day${days > 1 ? 's' : ''}`;
      })()
    : null;

  const itemPill = (label: string, value: string) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span className="text-[13px] font-semibold text-[var(--text)]">{value || '\u2014'}</span>
    </div>
  );

  const noteRow = (title: string, notes: string[] | undefined) => (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">{title}</div>
      {notes && notes.length ? (
        <div className="flex flex-wrap gap-1.5">
          {notes.map((n, i) => (
            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[11px] text-[var(--text-secondary)] font-medium">
              {n}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[11px] text-[var(--text-muted)]">Not recorded</span>
      )}
    </div>
  );

  const reasons: Record<StockMovement['movement_reason'], string> = {
    PURCHASE: 'Purchase', PO_RECEIVING: 'PO Receiving', PURCHASE_RETURN: 'Purchase Return',
    SALE: 'Sale', RETURN: 'Return', RETURN_RESTOCK: 'Restocked', DAMAGE: 'Damage',
    DAMAGED_WRITE_OFF: 'Damaged Write-off', LOSS: 'Loss', TRANSFER: 'Transfer',
    MARKETING_SAMPLE: 'Marketing Sample', GIFT: 'Gift', ADJUSTMENT: 'Adjustment',
    OPENING_BALANCE: 'Opening Balance', TESTER_CONVERSION: 'Tester Conversion',
  };

  return (
    <Modal size="xl" onClose={onClose} open className="max-h-[90vh]">
      {/* Header identity */}
      <div className="flex items-start justify-between gap-4 py-1">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold text-[var(--text)] leading-tight break-words">{product.display_name}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-[var(--text-secondary)]">
            <span className="font-num font-semibold text-[var(--accent)]">{product.sku}</span>
            {product.perfume_type && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[var(--surface-sunken)]">{product.perfume_type}</span>
            )}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[var(--surface-sunken)]">{product.concentration}</span>
            {product.is_bundle && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--accent-secondary)_12%,transparent)] text-[var(--accent-secondary)] font-bold">Bundle</span>
            )}
            {!product.active && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[var(--status-red)] text-white text-[10px] font-bold">Inactive</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <button type="button" onClick={onEdit} className="erp-btn-secondary inline-flex items-center gap-1.5">
              <PencilLine className="w-3.5 h-3.5" /> Edit Product
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="shrink-0 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] -mx-1 px-1 mb-4">
        {([
          ['overview', 'Overview'],
          ['sales', 'Sales History'],
          ['batches', 'Batches'],
          ['history', 'Stock History'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-[12px] font-semibold border-b-2 -mb-px cursor-pointer transition-colors ${
              tab === key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Image + quick identity */}
          <div className="flex gap-4">
            {product.photo_url ? (
              <img src={product.photo_url} alt={product.display_name} className="w-36 h-36 rounded-xl object-cover border border-[var(--border)] shrink-0" />
            ) : (
              <div className="w-36 h-36 rounded-xl bg-[var(--surface-sunken)] flex items-center justify-center shrink-0 border border-[var(--border)]">
                <Package className="w-10 h-10 text-[var(--text-muted)]" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 flex-1 content-start">
              {itemPill('Brand', product.brand)}
              {itemPill('Barcode', product.barcode || '\u2014')}
              {itemPill('Size', product.size_variant)}
              {itemPill('Gender / Target', product.gender || '\u2014')}
              {itemPill('Category', product.category_name || 'General')}
              {itemPill('Gross Weight', product.gross_weight !== undefined && product.gross_weight > 0 ? `${product.gross_weight} g` : 'Not set')}
              {itemPill('Selling Price', fmtMoney(product.selling_price))}
              {itemPill('Wholesale Price', fmtMoney(product.wholesale_price))}
              {itemPill('Avg Cost (Landed)', fmtMoney(product.avg_cost))}
            </div>
          </div>

          {/* Inventory & Location per warehouse */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Inventory & Location</div>
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] bg-[var(--surface-sunken)]">
                      <th className="px-3 py-2">Warehouse</th>
                      <th className="px-3 py-2 text-right font-num">On Hand</th>
                      <th className="px-3 py-2 text-right font-num">Reserved</th>
                      <th className="px-3 py-2 text-right font-num">Available</th>
                      <th className="px-3 py-2">Shelf Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(product.stock_by_warehouse && product.stock_by_warehouse.length ? product.stock_by_warehouse : []).map(w => (
                      <tr key={w.warehouse_id} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2 font-medium text-[var(--text)]">{w.warehouse_name}</td>
                        <td className="px-3 py-2 text-right font-num">{w.on_hand}</td>
                        <td className="px-3 py-2 text-right font-num">{w.reserved}</td>
                        <td className="px-3 py-2 text-right font-num font-semibold">{w.available}</td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                          {w.warehouse_id === 'wh_shop' ? (
                            product.location_shop ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] font-semibold text-xs">
                                {product.location_shop}
                              </span>
                            ) : (
                              '\u2014'
                            )
                          ) : w.warehouse_id === 'wh_main' ? (
                            product.location_main ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] font-semibold text-xs">
                                {product.location_main}
                              </span>
                            ) : (
                              '\u2014'
                            )
                          ) : (
                            '\u2014'
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!product.stock_by_warehouse || product.stock_by_warehouse.length === 0) && (
                      <tr className="border-t border-[var(--border)]">
                        <td colSpan={5} className="px-3 py-3 text-center text-[12px] text-[var(--text-muted)]">No inventory records yet for this product.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Dates / History summary */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Dates & History</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DateCard icon={<CalendarDays className="w-3.5 h-3.5" />} label="Record Created" value={fmtDate(product.created_at)} empty="Not recorded" />
              <DateCard icon={<History className="w-3.5 h-3.5" />} label="First Stock Received" value={fmtDate(firstReceived)} empty="No stock received yet" />
              <DateCard icon={<History className="w-3.5 h-3.5" />} label="Latest Stock Received" value={fmtDate(latestReceived)} empty="No stock received yet" />
              <DateCard icon={<History className="w-3.5 h-3.5" />} label="Stock Age" value={stockAgeLabel} empty="&#8212;" />
            </div>
          </div>

          {/* Fragrance notes */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Fragrance Notes</div>
            {(!product.top_notes || !product.top_notes.length) &&
            (!product.heart_notes || !product.heart_notes.length) &&
            (!product.base_notes || !product.base_notes.length) &&
            (!product.main_accords || !product.main_accords.length) ? (
              <div className="text-[12px] text-[var(--text-muted)]">Fragrance notes not added yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {noteRow('Top Notes', product.top_notes)}
                {noteRow('Heart Notes', product.heart_notes)}
                {noteRow('Base Notes', product.base_notes)}
                {noteRow('Main Accords', product.main_accords)}
              </div>
            )}
          </div>

          {/* Compact batch summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Batches</div>
              {batches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab('batches')}
                  className="erp-btn-secondary shrink-0 inline-flex items-center gap-1.5 py-1 px-2.5 text-[11px]"
                >
                  <Layers className="w-3.5 h-3.5" /> View Batch History
                </button>
              )}
            </div>
            {batches.length === 0 ? (
              <div className="text-[12px] text-[var(--text-muted)]">No batched stock recorded.</div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const active = batches.filter(b => b.quantity_remaining > 0);
                  const target = active.length > 0 ? active : batches;
                  const display = target.slice(0, 4);
                  const extra = target.length - display.length;
                  return (
                    <>
                      {display.map(b => {
                        const maturityDays = calcMaturityDays(b.manufacturing_date);
                        return (
                          <div
                            key={b.id}
                            className="border border-[var(--border)] rounded-lg p-2.5 bg-[var(--card)] hover:border-[var(--accent)] transition-colors"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-num font-semibold text-[13px] text-[var(--text)] tracking-tight">
                                  {b.batch_code || '\u2014'}
                                </span>
                                <span className="text-[var(--text-muted)] text-[11px]">&#183;</span>
                                <span className="text-[12px] text-[var(--text-secondary)] truncate">
                                  {b.warehouse_name || b.location || '\u2014'}
                                </span>
                              </div>
                              <span className="font-num font-bold text-[12px] text-[var(--accent)] shrink-0">
                                {b.quantity_remaining} pcs
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 pt-1.5 border-t border-[var(--border)] text-[11px] font-num text-[var(--text-secondary)]">
                              <div>
                                <span className="text-[var(--text-muted)] font-medium mr-1">MFG:</span>
                                <span className="text-[var(--text)] font-medium">
                                  {fmtDate(b.manufacturing_date) || '\u2014'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[var(--text-muted)] font-medium mr-1">EXP:</span>
                                <span className="text-[var(--text)] font-medium">
                                  {fmtDate(b.expiry_date) || '\u2014'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[var(--text-muted)] font-medium mr-1">Maturity:</span>
                                <span className="text-[var(--text)] font-medium">
                                  {maturityDays !== null ? `${maturityDays} day${maturityDays === 1 ? '' : 's'}` : '\u2014'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {extra > 0 && (
                        <div className="text-[11px] text-[var(--text-muted)]">+{extra} more batches</div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Quick Sales Performance & History Banner */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] flex items-center justify-center text-[var(--accent)] shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[12px] font-semibold text-[var(--text)]">Sales Performance & Ledger</div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Lifetime units sold, order velocity, and completed sales history
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTab('sales')}
              className="erp-btn-secondary text-[11px] inline-flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> View Sales History
            </button>
          </div>
        </div>
      )}

      {/* SALES HISTORY */}
      {tab === 'sales' && (
        <ProductSalesHistoryTab
          product={product}
          latestReceivedDate={latestReceived}
          movements={movements}
        />
      )}

      {/* BATCHES */}
      {tab === 'batches' && (
        <div className="space-y-4">
          {batches.length === 0 ? (
            <div className="text-[12px] text-[var(--text-muted)]">No batch records for this product.</div>
          ) : (
            <div className="space-y-2">
              {batches.map(b => {
                const maturityDays = calcMaturityDays(b.manufacturing_date);
                return (
                  <div key={b.id} className="border border-[var(--border)] rounded-lg px-3.5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-num font-semibold text-[var(--text)]">{b.batch_code || 'Unnamed batch'}</span>
                        {b.authenticity_status && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            b.authenticity_status === 'verified' ? 'bg-[color-mix(in_srgb,var(--status-green)_14%,transparent)] text-[var(--status-green)]'
                            : b.authenticity_status === 'questionable' ? 'bg-[color-mix(in_srgb,var(--status-red)_12%,transparent)] text-[var(--status-red)]'
                            : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)]'
                          }`}>{b.authenticity_status}</span>
                        )}
                      </div>
                      <span className="font-num font-semibold text-[12px] text-[var(--text)]">
                        {b.quantity_remaining} pcs left ({b.quantity_received} received)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-2 text-[12px]">
                      {itemPill('Warehouse', b.warehouse_name || '\u2014')}
                      {itemPill('Qty Remaining', `${b.quantity_remaining} pcs`)}
                      {itemPill('MFG Date', fmtDate(b.manufacturing_date) || '\u2014')}
                      {itemPill('EXP Date', fmtDate(b.expiry_date) || '\u2014')}
                      {itemPill('Maturity', maturityDays !== null ? `${maturityDays} day${maturityDays === 1 ? '' : 's'}` : '\u2014')}
                      {itemPill('Received', fmtDate(b.received_at || b.import_date) || '\u2014')}
                    </div>
                    {b.supplier_name && <div className="mt-1 text-[11px] text-[var(--text-secondary)]">Supplier: {b.supplier_name}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STOCK HISTORY */}
      {tab === 'history' && (
        <div className="space-y-4">
          {movements.length === 0 ? (
            <div className="text-[12px] text-[var(--text-muted)]">No stock movements recorded for this product.</div>
          ) : (
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] bg-[var(--surface-sunken)]">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2">Warehouse</th>
                      <th className="px-3 py-2 text-right font-num">Qty</th>
                      <th className="px-3 py-2 text-right font-num">Unit Cost</th>
                      <th className="px-3 py-2">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...movements]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .slice(0, 50)
                      .map(m => (
                        <tr key={m.id} className="border-t border-[var(--border)]">
                          <td className="px-3 py-2 text-[var(--text-secondary)] font-num">{fmtDate(m.created_at)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              m.quantity_delta > 0
                                ? 'bg-[color-mix(in_srgb,var(--status-green)_12%,transparent)] text-[var(--status-green)]'
                                : 'bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)]'
                            }`}>{reasons[m.movement_reason] || m.movement_reason}</span>
                          </td>
                          <td className="px-3 py-2 text-[var(--text-secondary)]">{m.warehouse_name || '\u2014'}</td>
                          <td className={`px-3 py-2 text-right font-num font-semibold ${m.quantity_delta >= 0 ? 'text-[var(--status-green)]' : 'text-[var(--status-red)]'}`}>
                            {m.quantity_delta >= 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                          </td>
                          <td className="px-3 py-2 text-right font-num text-[var(--text-secondary)]">&#2547;{m.unit_cost || 0}</td>
                          <td className="px-3 py-2 text-[var(--text-secondary)]">{m.created_by_name || m.created_by || '\u2014'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

// Compact date/stat tile used in the Overview dates grid.
const DateCard: React.FC<{ icon: React.ReactNode; label: string; value: string | null; empty: string }> = ({ icon, label, value, empty }) => (
  <div className="border border-[var(--border)] rounded-lg px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
      {icon} {label}
    </div>
    <div className="mt-1 text-[13px] font-semibold text-[var(--text)] font-num">
      {value ?? <span className="font-normal text-[var(--text-muted)]">{empty}</span>}
    </div>
  </div>
);

/* ---------------------------------------------------------------------------
 * Bulk selection output helpers (Print / Export PDF / Export Excel (CSV) /
 * Retail Price List / Wholesale Price List). None of these expose product
 * cost/margin figures. The Wholesale Price List is the ONE generation path
 * that includes wholesale prices, and it is gated on the caller having the
 * 'view_cost_margin' toggle (checked in runBulkAction before calling).
 * ------------------------------------------------------------------------- */

const productListColumns = (wholesale: boolean) => [
  'SKU', 'Product', 'Brand', 'Size', 'Concentration', 'Gender', 'Barcode',
  'Available', 'Shop Floor', 'Main Store', 'Price (\u09F3)', ...(wholesale ? ['Wholesale (\u09F3)'] : []),
];

const productListRows = (products: Product[], wholesale: boolean) =>
  products.map(p => [
    p.sku || '',
    p.display_name || p.name || '',
    p.brand || '',
    p.size_variant || '',
    p.concentration || '',
    p.gender || '',
    p.barcode || '',
    String(p.stock_available ?? 0),
    String(p.stock_by_warehouse?.find(w => w.warehouse_id === 'wh_shop')?.on_hand ?? 0),
    String(p.stock_by_warehouse?.find(w => w.warehouse_id === 'wh_main')?.on_hand ?? 0),
    (p.selling_price ?? 0).toLocaleString(),
    ...(wholesale ? [(p.wholesale_price ?? 0).toLocaleString()] : []),
  ]);

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csvContent));
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportProductCsv(products: Product[], wholesale: boolean) {
  downloadCsv(`mirage_products_${new Date().toISOString().slice(0, 10)}.csv`,
    productListColumns(wholesale), productListRows(products, wholesale));
}

function exportProductPdf(products: Product[], priceListOnly: boolean) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const now = new Date();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(priceListOnly ? 'Retail Price List' : 'Product Price List', 10, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`Mirage Perfume \u00B7 ${products.length} product${products.length === 1 ? '' : 's'} \u00B7 ${now.toLocaleDateString()} ${now.toLocaleTimeString().slice(0, 5)}`, 10, 16);
  doc.setTextColor(20, 20, 20);

  const headers = ['SKU', 'Product', 'Brand', 'Size', 'Price (BDT)'];
  const colWidths = [24, 90, 40, 24, 35];
  let y = 24;
  const rowH = 8;
  const pageH = 210; // A4 landscape height (mm)
  doc.setFillColor(22, 50, 79);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  let x = 10;
  headers.forEach((h, i) => {
    doc.setFillColor(22, 50, 79);
    doc.rect(x, y, colWidths[i], rowH - 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(h, x + 1.5, y + 5);
    x += colWidths[i];
  });
  doc.setTextColor(25, 25, 25);
  y += rowH;

  let i = 0;
  for (const p of products) {
    if (y > pageH - 20) {
      doc.addPage();
      y = 10;
      doc.setFillColor(22, 50, 79);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      x = 10;
      headers.forEach((h, k) => {
        doc.rect(x, y, colWidths[k], rowH - 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(h, x + 1.5, y + 5);
        x += colWidths[k];
      });
      doc.setTextColor(25, 25, 25);
      y += rowH;
    }
    if (i % 2 === 1) doc.setFillColor(240, 240, 240);
    else doc.setFillColor(255, 255, 255);
    doc.rect(10, y, colWidths.reduce((a, b) => a + b, 0), rowH, 'F');
    const cells = [p.sku || '', p.display_name || p.name || '', p.brand || '', p.size_variant || '', `\u09F3${(p.selling_price ?? 0).toLocaleString()}`];
    x = 10;
    cells.forEach((c, k) => {
      doc.setTextColor(25, 25, 25);
      doc.text(doc.getTextWidth(c) > colWidths[k] ? c.slice(0, Math.floor(colWidths[k] / 1.7)) : c, x + 1.5, y + 5);
      x += colWidths[k];
    });
    y += rowH;
    i++;
  }

  doc.save(`mirage_${priceListOnly ? 'retail_price_list' : 'product_list'}_${now.toISOString().slice(0, 10)}.pdf`);
}

function exportWholesalePriceList(products: Product[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const now = new Date();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Wholesale Price List', 10, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`Mirage Perfume \u00B7 ${products.length} product${products.length === 1 ? '' : 's'} \u00B7 ${now.toLocaleDateString()} ${now.toLocaleTimeString().slice(0, 5)} \u00B7 Internal`, 10, 16);
  doc.setTextColor(20, 20, 20);

  const headers = ['SKU', 'Product', 'Size', 'Price (BDT)', 'Wholesale (BDT)'];
  const colWidths = [24, 90, 24, 35, 40];
  let y = 24;
  const rowH = 8;
  const pageH = 210; // A4 landscape height (mm)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  let x = 10;
  headers.forEach((h, k) => {
    doc.setFillColor(22, 50, 79);
    doc.rect(x, y, colWidths[k], rowH - 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(h, x + 1.5, y + 5);
    x += colWidths[k];
  });
  doc.setTextColor(25, 25, 25);
  y += rowH;

  let i = 0;
  for (const p of products) {
    if (y > pageH - 20) {
      doc.addPage();
      y = 10;
      x = 10;
      doc.setFillColor(22, 50, 79);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      headers.forEach((h, k) => {
        doc.rect(x, y, colWidths[k], rowH - 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(h, x + 1.5, y + 5);
        x += colWidths[k];
      });
      doc.setTextColor(25, 25, 25);
      y += rowH;
    }
    if (i % 2 === 1) doc.setFillColor(240, 240, 240);
    else doc.setFillColor(255, 255, 255);
    doc.rect(10, y, colWidths.reduce((a, b) => a + b, 0), rowH, 'F');
    const cells = [p.sku || '', p.display_name || p.name || '', p.size_variant || '',
      `\u09F3${(p.selling_price ?? 0).toLocaleString()}`,
      p.wholesale_price !== undefined && p.wholesale_price !== null ? `\u09F3${p.wholesale_price.toLocaleString()}` : '\u2014'];
    x = 10;
    cells.forEach((c, k) => {
      doc.setTextColor(25, 25, 25);
      doc.text(doc.getTextWidth(c) > colWidths[k] ? c.slice(0, Math.floor(colWidths[k] / 1.7)) : c, x + 1.5, y + 5);
      x += colWidths[k];
    });
    y += rowH;
    i++;
  }

  doc.save(`mirage_wholesale_price_list_${now.toISOString().slice(0, 10)}.pdf`);
}

function printProductList(products: Product[]) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const content = `<html><head><style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222222; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #6B6B6B; font-size: 11px; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; font-size: 11px; }
    th { background: #EEF0F4; font-weight: bold; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    @media print { body { margin: 0; } }
  </style></head><body>
    <h1>Product Price List</h1>
    <div class="meta">Mirage Perfume \u00B7 ${products.length} product${products.length === 1 ? '' : 's'} \u00B7 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString().slice(0, 5)} \u00B7 Internal \u2014 cost/margin not shown</div>
    <table><thead><tr>
      <th>SKU</th><th>Product</th><th>Brand</th><th>Size</th><th>Conc.</th><th>Barcode</th>
      <th class="align-right">Available</th><th class="align-right">Shop</th><th class="align-right">Main</th><th class="align-right">Price (BDT)</th>
    </tr></thead><tbody>
    ${products.map(p => {
      const esc = (v: string) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<tr>
      <td>${esc(p.sku || '')}</td>
      <td>${esc(p.display_name || p.name || '')}</td>
      <td>${esc(p.brand || '')}</td>
      <td>${esc(p.size_variant || '')}</td>
      <td>${esc(p.concentration || '')}</td>
      <td>${esc(p.barcode || '')}</td>
      <td class="num">${p.stock_available ?? 0}</td>
      <td class="num">${p.stock_by_warehouse?.find(w => w.warehouse_id === 'wh_shop')?.on_hand ?? 0}</td>
      <td class="num">${p.stock_by_warehouse?.find(w => w.warehouse_id === 'wh_main')?.on_hand ?? 0}</td>
      <td class="num">\u09F3${(p.selling_price ?? 0).toLocaleString()}</td>
    </tr>`;
    }).join('')}
    </tbody></table>
  </body></html>`;
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(content);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 300);
}

const NotesPreviewModal: React.FC<{ product: Product; onClose: () => void }> = ({ product, onClose }) => {
  const hasNotes =
    (product.top_notes && product.top_notes.length) ||
    (product.heart_notes && product.heart_notes.length) ||
    (product.base_notes && product.base_notes.length) ||
    (product.main_accords && product.main_accords.length);

  const list = (v: string[] | undefined) =>
    v && v.length ? v.map((n, i) => <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[11px] text-[var(--text-secondary)] font-medium">{n}</span>)
      : <span className="text-[11px] text-[var(--text-muted)]">Not set</span>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-[var(--card)] w-full max-w-sm rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">Fragrance Notes</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <div className="font-semibold text-[var(--text)] break-words">{product.display_name}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {product.perfume_type || '\u2014'} &#183; {product.concentration}
            </div>
          </div>
          {!hasNotes && (
            <div className="text-[12px] text-[var(--text-muted)]">No fragrance notes stored for this product.</div>
          )}
          {hasNotes && (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Top Notes</div>
                <div className="flex flex-wrap gap-1.5">{list(product.top_notes)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Heart Notes</div>
                <div className="flex flex-wrap gap-1.5">{list(product.heart_notes)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Base Notes</div>
                <div className="flex flex-wrap gap-1.5">{list(product.base_notes)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Main Accords</div>
                <div className="flex flex-wrap gap-1.5">{list(product.main_accords)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* -------------------- Receive Stock Modal -------------------- */
const ReceiveModal: React.FC<{ products: Product[]; onClose: () => void; onSubmit: (data: any) => void; isSubmitting: boolean }> = ({ products, onClose, onSubmit, isSubmitting }) => {
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState('wh_shop');
  const [qty, setQty] = useState('1');
  const [cost, setCost] = useState('');
  const [supplier, setSupplier] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-[var(--card)] w-full max-w-md rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Receive Stock</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)]"><X className="w-5 h-5" /></button>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            onSubmit({ product_id: productId, warehouse_id: warehouseId, qty_received: Number(qty), landed_cost_per_unit: Number(cost), supplier_name: supplier, notes: 'Received via Products screen' });
          }}
          className="p-5 space-y-4"
        >
          <Field label="Product">
            <select value={productId} onChange={e => setProductId(e.target.value)} className={inputCls}>
              {products.map(p => <option key={p.id} value={p.id}>{p.display_name} ({p.sku})</option>)}
            </select>
          </Field>
          <Field label="Warehouse">
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={inputCls}>
              <option value="wh_shop">Shop Floor (Showroom)</option>
              <option value="wh_main">Main / Back-store (2nd Floor)</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <input type="number" required min="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Landed Cost / Unit (&#2547;)">
              <input type="number" required min="0" value={cost} onChange={e => setCost(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Supplier (optional)">
            <input value={supplier} onChange={e => setSupplier(e.target.value)} className={inputCls} />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text)]">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--accent)] disabled:opacity-50" disabled={isSubmitting}>
              {isSubmitting ? 'Receiving...' : 'Receive'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* -------------------- Opening Balance Modal -------------------- */
const OpeningModal: React.FC<{ products: Product[]; onClose: () => void; onSubmit: (data: any) => void; isSubmitting: boolean }> = ({ products, onClose, onSubmit, isSubmitting }) => {
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState('wh_shop');
  const [qty, setQty] = useState('0');
  const [cost, setCost] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-[var(--card)] w-full max-w-md rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Opening Balance</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)]"><X className="w-5 h-5" /></button>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            onSubmit({ product_id: productId, warehouse_id: warehouseId, quantity: Number(qty), unit_cost: Number(cost), date });
          }}
          className="p-5 space-y-4"
        >
          <Field label="Product">
            <select value={productId} onChange={e => setProductId(e.target.value)} className={inputCls}>
              {products.map(p => <option key={p.id} value={p.id}>{p.display_name} ({p.sku})</option>)}
            </select>
          </Field>
          <Field label="Warehouse">
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={inputCls}>
              <option value="wh_shop">Shop Floor (Showroom)</option>
              <option value="wh_main">Main / Back-store (2nd Floor)</option>
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantity">
              <input type="number" required min="0" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Unit Cost (&#2547;)">
              <input type="number" min="0" value={cost} onChange={e => setCost(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Date">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text)]">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--accent)] disabled:opacity-50" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* -------------------- Bulk CSV Modal -------------------- */
const BulkModal: React.FC<{ onClose: () => void; onSubmit: (rows: any[]) => void; isSubmitting: boolean }> = ({ onClose, onSubmit, isSubmitting }) => {
  const [text, setText] = useState('');

  const parseCsv = (raw: string): any[] => {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      header.forEach((h, i) => { obj[h] = cells[i]; });
      return obj;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-[var(--card)] w-full max-w-lg rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Bulk CSV Import</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)]"><X className="w-5 h-5" /></button>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            onSubmit(parseCsv(text));
          }}
          className="p-5 space-y-4"
        >
          <p className="text-sm text-[var(--text-secondary)]">
            Column order: <code className="font-mono">name, brand, size_variant, category, barcode, sku, purchase_price, selling_price, low_stock_threshold</code>. One row per line.
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
            placeholder={'name, brand, size_variant, category, barcode, sku, purchase_price, selling_price, low_stock_threshold\nKarus Gold Absolu, Khadlaj, 100ML, Amber Gourmand, 6291118301163, KDL006, 2000, 2750, 3'}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text)]">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--accent)] disabled:opacity-50" disabled={isSubmitting}>
              {isSubmitting ? 'Importing...' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* -------------------- Combo Bundle Builder Modal -------------------- */
const BundleBuilderModal: React.FC<{
  products: Product[];
  onClose: () => void;
  onCreate: (data: any) => Promise<Product>;
  refreshAll: () => Promise<void>;
  isSubmitting: boolean;
  setIsSubmitting: (b: boolean) => void;
  setErrorMsg: (s: string | null) => void;
  showSuccess: (s: string) => void;
}> = ({ products, onClose, onCreate, refreshAll, isSubmitting, setIsSubmitting, setErrorMsg, showSuccess }) => {
  const [bundleName, setBundleName] = useState('');
  const [bundlePrice, setBundlePrice] = useState('');
  const [lines, setLines] = useState<{ product_id: string; quantity: number }[]>([
    { product_id: products[0]?.id || '', quantity: 1 },
  ]);

  const nonBundle = products.filter(p => !p.is_bundle);

  const addLine = () => setLines(l => [...l, { product_id: nonBundle[0]?.id || '', quantity: 1 }]);
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<{ product_id: string; quantity: number }>) =>
    setLines(l => l.map((line, idx) => idx === i ? { ...line, ...patch } : line));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundleName.trim() || !bundlePrice) { setErrorMsg('Bundle name and price required.'); return; }
    const validLines = lines.filter(l => l.product_id && l.quantity > 0);
    if (!validLines.length) { setErrorMsg('Add at least one component.'); return; }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onCreate({
        brand: 'Bundle',
        name: bundleName.trim(),
        concentration: 'EDP',
        size_variant: 'SET',
        category_name: 'Gift Sets & Combos',
        selling_price: Number(bundlePrice),
        avg_cost: 0,
        low_stock_threshold: 1,
        is_bundle: true,
        bundle_components: validLines.map(l => ({ component_product_id: l.product_id, quantity: l.quantity })),
      });
      await refreshAll();
      showSuccess('Bundle created successfully.');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create bundle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-[var(--card)] w-full max-w-lg rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Create Combo Bundle</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={create} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bundle Name">
              <input required value={bundleName} onChange={e => setBundleName(e.target.value)} className={inputCls} placeholder="e.g. His & Hers Combo" />
            </Field>
            <Field label="Selling Price (&#2547;)">
              <input type="number" required min="0" value={bundlePrice} onChange={e => setBundlePrice(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--text)]">Components</span>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
                <Plus className="w-3.5 h-3.5" /> Add line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={line.product_id}
                    onChange={e => updateLine(i, { product_id: e.target.value })}
                    className={inputCls}
                  >
                    {nonBundle.map(p => <option key={p.id} value={p.id}>{p.display_name} ({p.sku})</option>)}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={e => updateLine(i, { quantity: Number(e.target.value) })}
                    className={`${inputCls} w-20`}
                  />
                  <button type="button" onClick={() => removeLine(i)} className="text-[var(--status-red)] hover:text-[var(--status-red)]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text)]">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--accent)] disabled:opacity-50" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Bundle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* -------------------- Delete Confirmation Modal (Triple Warning) -------------------- */
const DeleteConfirmModal: React.FC<{
  product: Product;
  step: number;
  reason: string;
  error: string | null;
  onStep: (s: number) => void;
  onReason: (r: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ product, step, reason, error, onStep, onReason, onCancel, onConfirm }) => {
  const warnings = [
    'This will permanently remove this product from your inventory.',
    'Deleting a product cannot be undone. Any references in history are preserved but the product will no longer appear in lists.',
    'Are you absolutely sure you want to delete this product?',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-[var(--card)] w-full max-w-md rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[var(--status-red)]" />
            <h2 className="text-lg font-semibold text-[var(--text)]">Delete Product</h2>
          </div>
          <button onClick={onCancel} className="text-[var(--text-secondary)] hover:text-[var(--text)]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm text-[var(--text)] font-medium">{product.display_name}</div>
          <div className="text-xs text-[var(--text-secondary)] font-mono">{product.sku} &#183; {product.barcode}</div>

          {/* Triple warning steps */}
          <div className="space-y-2">
            {warnings.map((w, i) => {
              const isActive = i === step;
              const isPassed = i < step;
              return (
                <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${
                  isPassed
                    ? 'border-[color-mix(in_srgb,var(--status-green)_25%,transparent)] bg-[color-mix(in_srgb,var(--status-green)_8%,transparent)] text-[var(--status-green)]'
                    : isActive
                      ? 'border-[color-mix(in_srgb,var(--status-amber)_30%,transparent)] bg-[color-mix(in_srgb,var(--status-amber)_8%,transparent)] text-[var(--status-amber)]'
                      : 'border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text-secondary)]'
                }`}>
                  {isPassed ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span className="text-sm">{w}</span>
                </div>
              );
            })}
          </div>

          {step >= 2 && (
            <Field label="Reason for deletion (required)">
              <input
                value={reason}
                onChange={e => onReason(e.target.value)}
                placeholder="e.g. No longer sold, replaced by new stock"
                className={inputCls}
              />
            </Field>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg pill-red text-sm">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            {step < 2 ? (
              <button
                onClick={() => onStep(step + 1)}
                className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: 'var(--status-amber)' }}
              >
                {step === 0 ? 'I Understand \u2014 Continue' : 'I Am Sure \u2014 Continue'}
              </button>
            ) : (
              <button
                onClick={onConfirm}
                disabled={!reason.trim()}
                className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--status-red)' }}
              >
                <Trash2 className="w-4 h-4 inline mr-1" /> Permanently Delete
              </button>
            )}
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text)]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------- Shared small components -------------------- */
const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

const Field: React.FC<{ label: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <label className="block">
    <span className="flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] mb-1">
      {icon}{label}
    </span>
    {children}
  </label>
);

/* Compact section header for grouping fields inside the edit modal. */
const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-xs font-bold uppercase tracking-wide text-[var(--accent)] mb-2">{children}</div>
);

/* A chip-based multi-value input with a suggestion library (autocomplete via datalist). */
const NoteChipField: React.FC<{
  label: string;
  value: string[];
  library: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}> = ({ label, value, library, onChange, placeholder }) => {
  const [text, setText] = useState('');

  const suggestions = library.filter(n => !value.includes(n));

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setText('');
  };

  const addOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add(text);
    }
  };

  const id = `datalist-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <Field label={label}>
      <div className="border border-[var(--border)] rounded-lg bg-[var(--surface-sunken)] p-2 focus-within:ring-2 focus-within:ring-[var(--accent)]">
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {value.map((n, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[11px] font-medium text-[var(--text-secondary)]">
                {n}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                  className="text-[var(--text-muted)] hover:text-[var(--status-red)] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          value={text}
          list={id}
          onChange={e => setText(e.target.value)}
          onKeyDown={addOnEnter}
          onBlur={() => add(text)}
          placeholder={placeholder || 'Type + Enter to add'}
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
        />
      </div>
      <datalist id={id}>
        {suggestions.map(n => <option key={n} value={n} />)}
      </datalist>
    </Field>
  );
};
