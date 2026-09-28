import React, { useMemo, useState } from 'react';
import {
  Search,
  Layers,
  Edit2,
  ArrowRightLeft,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Package,
  Boxes,
  MoveRight,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { PageHeader } from '../common/PageHeader';
import { Modal } from '../common/Modal';
import { parseLocation, formatLocation, getProductLocation } from '../../lib/locationHelpers';

interface LocationGroup {
  rack: string;
  shelves: {
    shelf: string;
    products: {
      product: Product;
      stockOnHand: number;
    }[];
  }[];
}

export const LocationsView: React.FC = () => {
  const { products, updateProduct } = useApp();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<'wh_shop' | 'wh_main'>('wh_shop');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'hierarchy' | 'table'>('hierarchy');

  // Single Product Edit Modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editRack, setEditRack] = useState('');
  const [editShelf, setEditShelf] = useState('');
  const [editWarehouse, setEditWarehouse] = useState<'wh_shop' | 'wh_main'>('wh_shop');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Bulk Reorganization Modal (Move Shelf / Rack)
  const [showReorganizeModal, setShowReorganizeModal] = useState(false);
  const [sourceRack, setSourceRack] = useState('');
  const [sourceShelf, setSourceShelf] = useState('');
  const [targetRack, setTargetRack] = useState('');
  const [targetShelf, setTargetShelf] = useState('');
  const [reorganizeMode, setReorganizeMode] = useState<'shelf' | 'rack'>('shelf');
  const [isReorganizing, setIsReorganizing] = useState(false);

  // Quick Place Unassigned Modal
  const [placingProduct, setPlacingProduct] = useState<Product | null>(null);

  // Parse and organize products by Warehouse -> Rack -> Shelf
  const { locationGroups, unassignedProducts, allRacks, allShelves } = useMemo(() => {
    const rackMap: Record<string, Record<string, { product: Product; stockOnHand: number }[]>> = {};
    const unassigned: Product[] = [];
    const rackSet = new Set<string>();
    const shelfSet = new Set<string>();

    products.forEach((p) => {
      const rawLoc = getProductLocation(p, selectedWarehouseId);
      const parsed = parseLocation(rawLoc);

      // Find stock on hand in selected warehouse
      const whStock = p.stock_by_warehouse?.find((w) => w.warehouse_id === selectedWarehouseId)?.on_hand ?? 0;

      if (!parsed.isAssigned) {
        unassigned.push(p);
      } else {
        rackSet.add(parsed.rack);
        shelfSet.add(parsed.shelf);

        if (!rackMap[parsed.rack]) {
          rackMap[parsed.rack] = {};
        }
        if (!rackMap[parsed.rack][parsed.shelf]) {
          rackMap[parsed.rack][parsed.shelf] = [];
        }
        rackMap[parsed.rack][parsed.shelf].push({
          product: p,
          stockOnHand: whStock,
        });
      }
    });

    // Build structured list sorted by rack and shelf name
    const sortedRacks = Object.keys(rackMap).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const groups: LocationGroup[] = sortedRacks.map((rack) => {
      const shelfObj = rackMap[rack];
      const sortedShelves = Object.keys(shelfObj).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );

      return {
        rack,
        shelves: sortedShelves.map((shelf) => ({
          shelf,
          products: shelfObj[shelf].sort((a, b) => a.product.display_name.localeCompare(b.product.display_name)),
        })),
      };
    });

    return {
      locationGroups: groups,
      unassignedProducts: unassigned,
      allRacks: Array.from(rackSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      allShelves: Array.from(shelfSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    };
  }, [products, selectedWarehouseId]);

  // Filter groups by search query (searches rack, shelf, product name, sku, brand)
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return locationGroups;
    const q = searchQuery.toLowerCase();

    return locationGroups
      .map((group) => {
        const rackMatches = group.rack.toLowerCase().includes(q);

        const filteredShelves = group.shelves
          .map((s) => {
            const shelfMatches = s.shelf.toLowerCase().includes(q);
            const filteredProducts = s.products.filter(
              ({ product }) =>
                product.display_name.toLowerCase().includes(q) ||
                product.sku.toLowerCase().includes(q) ||
                product.brand.toLowerCase().includes(q) ||
                (product.barcode && product.barcode.includes(q))
            );

            if (rackMatches || shelfMatches) {
              return s;
            }
            if (filteredProducts.length > 0) {
              return { ...s, products: filteredProducts };
            }
            return null;
          })
          .filter(Boolean) as LocationGroup['shelves'];

        if (filteredShelves.length > 0) {
          return { ...group, shelves: filteredShelves };
        }
        return null;
      })
      .filter(Boolean) as LocationGroup[];
  }, [locationGroups, searchQuery]);

  // Filtered flat product list for table view
  const filteredTableProducts = useMemo(() => {
    let list = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => {
        const shopLoc = (p.location_shop || '').toLowerCase();
        const mainLoc = (p.location_main || '').toLowerCase();
        const name = p.display_name.toLowerCase();
        const sku = p.sku.toLowerCase();
        const brand = p.brand.toLowerCase();
        return name.includes(q) || sku.includes(q) || brand.includes(q) || shopLoc.includes(q) || mainLoc.includes(q);
      });
    }
    return list;
  }, [products, searchQuery]);

  // Open Edit Modal for a product
  const handleOpenEdit = (product: Product, whId: 'wh_shop' | 'wh_main' = selectedWarehouseId) => {
    const rawLoc = getProductLocation(product, whId);
    const parsed = parseLocation(rawLoc);

    setEditingProduct(product);
    setEditWarehouse(whId);
    setEditRack(parsed.isAssigned ? parsed.rack.replace(/^Rack\s*/i, '') : '');
    setEditShelf(parsed.isAssigned ? parsed.shelf.replace(/^Shelf\s*/i, '') : '');
    setSaveError(null);
    setSaveSuccess(null);
  };

  // Save product location
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setIsSaving(true);
    setSaveError(null);

    const formatted = formatLocation(editRack, editShelf);
    const updatePayload: Partial<Product> =
      editWarehouse === 'wh_shop' ? { location_shop: formatted || undefined } : { location_main: formatted || undefined };

    try {
      await updateProduct(editingProduct.id, updatePayload);
      setSaveSuccess(`Location updated to ${formatted || 'Unassigned'}`);
      setTimeout(() => {
        setEditingProduct(null);
        setSaveSuccess(null);
      }, 900);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update location');
    } finally {
      setIsSaving(false);
    }
  };

  // Execute bulk reorganize (Move Shelf or Rack)
  const handleExecuteReorganize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceRack || !targetRack) return;
    if (reorganizeMode === 'shelf' && (!sourceShelf || !targetShelf)) return;

    setIsReorganizing(true);

    try {
      const updates: Promise<any>[] = [];

      products.forEach((p) => {
        const rawLoc = getProductLocation(p, selectedWarehouseId);
        const parsed = parseLocation(rawLoc);

        if (!parsed.isAssigned) return;

        let shouldMove = false;
        let newLocation = '';

        if (reorganizeMode === 'rack' && parsed.rack === sourceRack) {
          shouldMove = true;
          newLocation = formatLocation(targetRack, parsed.shelf);
        } else if (reorganizeMode === 'shelf' && parsed.rack === sourceRack && parsed.shelf === sourceShelf) {
          shouldMove = true;
          newLocation = formatLocation(targetRack, targetShelf);
        }

        if (shouldMove) {
          const payload =
            selectedWarehouseId === 'wh_shop'
              ? { location_shop: newLocation }
              : { location_main: newLocation };
          updates.push(updateProduct(p.id, payload));
        }
      });

      await Promise.all(updates);
      setShowReorganizeModal(false);
    } catch (err: any) {
      alert(`Reorganize failed: ${err.message}`);
    } finally {
      setIsReorganizing(false);
    }
  };

  const totalAssignedProducts = products.length - unassignedProducts.length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Inventory"
        title="Location Management"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSourceRack(allRacks[0] || 'Rack A');
                setSourceShelf(allShelves[0] || 'Shelf 1');
                setTargetRack(allRacks[1] || 'Rack B');
                setTargetShelf(allShelves[0] || 'Shelf 1');
                setShowReorganizeModal(true);
              }}
              className="erp-btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Reorganize Shelf / Rack</span>
            </button>
          </div>
        }
      />

      {/* Warehouse Selector & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Warehouse Switcher */}
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
            <button
              type="button"
              onClick={() => setSelectedWarehouseId('wh_shop')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                selectedWarehouseId === 'wh_shop'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Shop Floor (Showroom)
            </button>
            <button
              type="button"
              onClick={() => setSelectedWarehouseId('wh_main')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                selectedWarehouseId === 'wh_main'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Main / Back-store (2nd Floor)
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('hierarchy')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                viewMode === 'hierarchy'
                  ? 'bg-[var(--surface-sunken)] text-[var(--text)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Rack &amp; Shelf Layout
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                viewMode === 'table'
                  ? 'bg-[var(--surface-sunken)] text-[var(--text)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Product Location List
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product, SKU, rack, shelf..."
            className="erp-input pl-8 w-full text-xs"
          />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Total Racks</div>
          <div className="text-lg font-bold font-num text-[var(--text)] mt-1">{locationGroups.length}</div>
        </div>
        <div className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Total Shelves</div>
          <div className="text-lg font-bold font-num text-[var(--text)] mt-1">
            {locationGroups.reduce((acc, g) => acc + g.shelves.length, 0)}
          </div>
        </div>
        <div className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Assigned SKUs</div>
          <div className="text-lg font-bold font-num text-[var(--status-green)] mt-1">{totalAssignedProducts}</div>
        </div>
        <div className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">Unassigned SKUs</div>
          <div className="text-lg font-bold font-num text-[var(--text-secondary)] mt-1">
            {unassignedProducts.length}
          </div>
        </div>
      </div>

      {/* VIEW 1: HIERARCHY (Warehouse -> Rack -> Shelf) */}
      {viewMode === 'hierarchy' && (
        <div className="space-y-4">
          {filteredGroups.length === 0 ? (
            <div className="border border-[var(--border)] rounded-xl p-8 text-center bg-[var(--surface)] text-xs text-[var(--text-muted)]">
              No racks or shelves found matching "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map((group) => (
                <div
                  key={group.rack}
                  className="border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden shadow-2xs flex flex-col"
                >
                  {/* Rack Header */}
                  <div className="p-3 bg-[var(--surface-sunken)] border-b border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-[var(--accent)]" />
                      <span className="font-bold text-sm text-[var(--text)]">{group.rack}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)] font-num">
                      {group.shelves.reduce((acc, s) => acc + s.products.length, 0)} items
                    </span>
                  </div>

                  {/* Shelves List */}
                  <div className="p-3 space-y-3 flex-1">
                    {group.shelves.map((shelfObj) => (
                      <div
                        key={shelfObj.shelf}
                        className="border border-[var(--border)] rounded-lg p-2.5 bg-[var(--surface)] space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs pb-1 border-b border-[var(--border)]/60">
                          <span className="font-bold text-[var(--accent)]">{shelfObj.shelf}</span>
                          <span className="text-[10px] text-[var(--text-secondary)] font-num">
                            {shelfObj.products.length} {shelfObj.products.length === 1 ? 'SKU' : 'SKUs'}
                          </span>
                        </div>

                        {/* Products on this shelf */}
                        <div className="space-y-1.5">
                          {shelfObj.products.map(({ product, stockOnHand }) => (
                            <div
                              key={product.id}
                              className="flex items-center justify-between p-1.5 rounded-md hover:bg-[var(--surface-hover)] transition-colors text-xs group"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-medium text-[var(--text)] truncate text-[11px]">
                                  {product.display_name}
                                </div>
                                <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-2 font-mono">
                                  <span>SKU: {product.sku}</span>
                                  <span className="font-semibold text-[var(--text)]">Stock: {stockOnHand}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(product)}
                                title="Edit Location"
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-opacity cursor-pointer shrink-0"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unassigned Section */}
          {unassignedProducts.length > 0 && !searchQuery && (
            <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="font-bold text-xs text-[var(--text)]">
                    Unassigned Products in {selectedWarehouseId === 'wh_shop' ? 'Shop Floor' : 'Main Store'} ({unassignedProducts.length})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {unassignedProducts.slice(0, 16).map((product) => (
                  <div
                    key={product.id}
                    className="p-2 border border-[var(--border)] rounded-lg flex items-center justify-between gap-2 bg-[var(--surface-sunken)] text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--text)] truncate text-[11px]">
                        {product.display_name}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] font-mono">SKU: {product.sku}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(product)}
                      className="px-2 py-0.5 text-[10px] font-semibold rounded bg-[var(--accent)] text-white hover:opacity-90 shrink-0 cursor-pointer"
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: FLAT TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="dense-table-container">
          <div className="overflow-x-auto">
            <table className="dense-table w-full">
              <thead>
                <tr>
                  <th className="text-left py-2.5 px-3">Product Name &amp; SKU</th>
                  <th className="text-left py-2.5 px-3">Brand</th>
                  <th className="text-center py-2.5 px-3 w-44">Shop Floor Location</th>
                  <th className="text-center py-2.5 px-3 w-44">Main Store Location</th>
                  <th className="text-right py-2.5 px-3 w-28">Shop Stock</th>
                  <th className="text-right py-2.5 px-3 w-28">Main Stock</th>
                  <th className="text-center py-2.5 px-3 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTableProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-xs text-[var(--text-muted)]">
                      No products found matching "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredTableProducts.map((p) => {
                    const shopStock = p.stock_by_warehouse?.find((w) => w.warehouse_id === 'wh_shop')?.on_hand ?? 0;
                    const mainStock = p.stock_by_warehouse?.find((w) => w.warehouse_id === 'wh_main')?.on_hand ?? 0;

                    return (
                      <tr key={p.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-xs text-[var(--text)]">{p.display_name}</div>
                          <div className="font-mono text-[10px] text-[var(--accent)] mt-0.5">SKU: {p.sku}</div>
                        </td>

                        <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)] font-medium">
                          {p.brand}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {p.location_shop ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] text-xs font-semibold text-[var(--accent)]">
                              {p.location_shop}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)] italic">Unassigned</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {p.location_main ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-[var(--surface-sunken)] border border-[var(--border)] text-xs font-semibold text-[var(--text)]">
                              {p.location_main}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)] italic">Unassigned</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-num font-bold text-xs text-[var(--text)]">
                          {shopStock}
                        </td>

                        <td className="py-2.5 px-3 text-right font-num font-bold text-xs text-[var(--text)]">
                          {mainStock}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="p-1 rounded hover:bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
                            title="Edit Location"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT LOCATION MODAL */}
      {editingProduct && (
        <Modal
          open={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          title="Edit Product Location"
          size="md"
        >
          <form onSubmit={handleSaveLocation} className="p-4 space-y-4">
            <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
              <div className="font-bold text-xs text-[var(--text)]">{editingProduct.display_name}</div>
              <div className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">
                SKU: {editingProduct.sku} · Brand: {editingProduct.brand}
              </div>
            </div>

            {saveError && (
              <div className="p-2.5 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_25%,transparent)] text-[var(--status-red)] rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-2.5 bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-green)_25%,transparent)] text-[var(--status-green)] rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Target Warehouse
                </label>
                <select
                  value={editWarehouse}
                  onChange={(e) => {
                    const wh = e.target.value as 'wh_shop' | 'wh_main';
                    setEditWarehouse(wh);
                    const raw = getProductLocation(editingProduct, wh);
                    const parsed = parseLocation(raw);
                    setEditRack(parsed.isAssigned ? parsed.rack.replace(/^Rack\s*/i, '') : '');
                    setEditShelf(parsed.isAssigned ? parsed.shelf.replace(/^Shelf\s*/i, '') : '');
                  }}
                  className="erp-select w-full"
                >
                  <option value="wh_shop">Shop Floor (Showroom)</option>
                  <option value="wh_main">Main / Back-store (2nd Floor)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                    Rack
                  </label>
                  <input
                    type="text"
                    value={editRack}
                    onChange={(e) => setEditRack(e.target.value)}
                    placeholder="e.g. A, B, 1, 2"
                    className="erp-input w-full text-xs font-semibold"
                  />
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--text-muted)]">
                    <span>Quick:</span>
                    {['A', 'B', 'C', '1', '2'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setEditRack(r)}
                        className="px-1.5 py-0.5 rounded bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] border border-[var(--border)] cursor-pointer"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                    Shelf
                  </label>
                  <input
                    type="text"
                    value={editShelf}
                    onChange={(e) => setEditShelf(e.target.value)}
                    placeholder="e.g. 1, 2, 3, Top"
                    className="erp-input w-full text-xs font-semibold"
                  />
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--text-muted)]">
                    <span>Quick:</span>
                    {['1', '2', '3', '4'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditShelf(s)}
                        className="px-1.5 py-0.5 rounded bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] border border-[var(--border)] cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-xs flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Formatted Location:</span>
                <span className="font-bold text-[var(--accent)] font-mono">
                  {formatLocation(editRack, editShelf) || 'Unassigned'}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="erp-btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="erp-btn-primary text-xs"
              >
                {isSaving ? 'Saving...' : 'Save Location'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* BULK REORGANIZE MODAL */}
      {showReorganizeModal && (
        <Modal
          open={showReorganizeModal}
          onClose={() => setShowReorganizeModal(false)}
          title="Reorganize Warehouse Locations"
          size="md"
        >
          <form onSubmit={handleExecuteReorganize} className="p-4 space-y-4">
            <div className="text-xs text-[var(--text-secondary)]">
              Move all products from one rack or shelf to another in{' '}
              <strong className="text-[var(--text)]">
                {selectedWarehouseId === 'wh_shop' ? 'Shop Floor' : 'Main Back-store'}
              </strong>
              .
            </div>

            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-0.5">
              <button
                type="button"
                onClick={() => setReorganizeMode('shelf')}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  reorganizeMode === 'shelf'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                Move Specific Shelf
              </button>
              <button
                type="button"
                onClick={() => setReorganizeMode('rack')}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  reorganizeMode === 'rack'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                Move Entire Rack
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Source */}
              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] space-y-2">
                <div className="font-bold text-[var(--text)] text-xs">Source Location</div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                    Source Rack
                  </label>
                  <input
                    type="text"
                    value={sourceRack}
                    onChange={(e) => setSourceRack(e.target.value)}
                    placeholder="e.g. Rack A"
                    className="erp-input w-full text-xs"
                    required
                  />
                </div>
                {reorganizeMode === 'shelf' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                      Source Shelf
                    </label>
                    <input
                      type="text"
                      value={sourceShelf}
                      onChange={(e) => setSourceShelf(e.target.value)}
                      placeholder="e.g. Shelf 1"
                      className="erp-input w-full text-xs"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Target */}
              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] space-y-2">
                <div className="font-bold text-[var(--text)] text-xs">Destination Location</div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                    Destination Rack
                  </label>
                  <input
                    type="text"
                    value={targetRack}
                    onChange={(e) => setTargetRack(e.target.value)}
                    placeholder="e.g. Rack B"
                    className="erp-input w-full text-xs"
                    required
                  />
                </div>
                {reorganizeMode === 'shelf' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                      Destination Shelf
                    </label>
                    <input
                      type="text"
                      value={targetShelf}
                      onChange={(e) => setTargetShelf(e.target.value)}
                      placeholder="e.g. Shelf 2"
                      className="erp-input w-full text-xs"
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowReorganizeModal(false)}
                className="erp-btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isReorganizing}
                className="erp-btn-primary text-xs inline-flex items-center gap-1.5"
              >
                <MoveRight className="w-3.5 h-3.5" />
                <span>{isReorganizing ? 'Reorganizing...' : 'Apply Move'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
