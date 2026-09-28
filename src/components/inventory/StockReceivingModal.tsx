import React, { useState, useEffect } from 'react';
import { Truck, Scan, X, CheckCircle2, AlertCircle, Sparkles, MapPin } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { parseLocation, formatLocation, getProductLocation } from '../../lib/locationHelpers';

interface StockReceivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProduct?: Product | null;
}

export const StockReceivingModal: React.FC<StockReceivingModalProps> = ({
  isOpen,
  onClose,
  initialProduct,
}) => {
  const { products, receiveStock, updateProduct } = useApp();

  const [productId, setProductId] = useState<string>(initialProduct?.id || products[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState<string>('wh_shop');
  const [qtyReceived, setQtyReceived] = useState<number>(10);
  const [landedCost, setLandedCost] = useState<number>(initialProduct?.avg_cost || 2000);
  const [supplierName, setSupplierName] = useState<string>('Dubai Luxury Imports LLC');
  const [notes, setNotes] = useState<string>('Shipment received via air cargo');
  
  // Storage Location Assignment
  const [rack, setRack] = useState<string>('');
  const [shelf, setShelf] = useState<string>('');

  // Point 2.3/2.4: batch maturity info + import damage routing.
  const [batchCode, setBatchCode] = useState<string>('');
  const [manufacturingDate, setManufacturingDate] = useState<string>('');
  const [importDate, setImportDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [qtyDamaged, setQtyDamaged] = useState<number>(0);
  const [damageSeverity, setDamageSeverity] = useState<'light' | 'medium' | 'heavy'>('light');
  const [damageNotes, setDamageNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync initial product / warehouse location
  useEffect(() => {
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      const raw = getProductLocation(prod, warehouseId);
      const parsed = parseLocation(raw);
      setRack(parsed.isAssigned ? parsed.rack.replace(/^Rack\s*/i, '') : '');
      setShelf(parsed.isAssigned ? parsed.shelf.replace(/^Shelf\s*/i, '') : '');
    }
  }, [productId, warehouseId, products]);

  if (!isOpen) return null;

  const handleProductSelect = (id: string) => {
    setProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setLandedCost(prod.avg_cost || 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || qtyReceived <= 0 || landedCost <= 0) {
      setErrorMsg('Please provide valid product, quantity, and landed cost.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await receiveStock({
        product_id: productId,
        warehouse_id: warehouseId,
        qty_received: qtyReceived,
        qty_damaged: qtyDamaged > 0 ? qtyDamaged : undefined,
        damage_severity: qtyDamaged > 0 ? damageSeverity : undefined,
        damage_notes: qtyDamaged > 0 ? damageNotes || `Damaged on import arrival` : undefined,
        landed_cost_per_unit: landedCost,
        supplier_name: supplierName,
        batch_code: batchCode || undefined,
        manufacturing_date: manufacturingDate || undefined,
        import_date: importDate || undefined,
        notes,
      });

      // Update storage location if provided
      if (rack.trim() || shelf.trim()) {
        const newLoc = formatLocation(rack, shelf);
        const updatePayload =
          warehouseId === 'wh_shop' ? { location_shop: newLoc } : { location_main: newLoc };
        await updateProduct(productId, updatePayload);
      }

      setSuccessMsg(
        `${qtyReceived} good units received${result.batch ? ` (batch ${result.batch.batch_code})` : ''}${
          qtyDamaged > 0 ? `, ${qtyDamaged} damaged → routed to damaged stock` : ''
        }. New Avg Cost: ৳${result.new_avg_cost}`
      );
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to receive stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-[var(--card)] rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-[var(--border)] space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--accent)]">Receive Stock (New Shipment)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text)] p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-[var(--status-red)]/10 border border-[var(--status-red)]/30 text-[var(--status-red)] rounded-md text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-[var(--status-green)]/10 border border-[var(--status-green)]/30 text-[var(--status-green)] rounded-md text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
              Select Product (Barcode Lookup)
            </label>
            <select
              value={productId}
              onChange={(e) => handleProductSelect(e.target.value)}
              className="w-full p-2 border border-[var(--border)] rounded-md bg-[var(--card)] font-medium text-xs focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.display_name} (Current Cost: ৳{p.avg_cost})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                Destination Warehouse
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full p-2 border border-[var(--border)] rounded-md bg-[var(--card)] text-xs"
              >
                <option value="wh_shop">Shop Floor (Showroom)</option>
                <option value="wh_main">Main / Back-store (2nd Floor)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                Quantity Received (Units)
              </label>
              <input
                type="number"
                min="1"
                value={qtyReceived}
                onChange={(e) => setQtyReceived(Number(e.target.value))}
                className="w-full p-2 border border-[var(--border)] rounded-md font-mono font-bold text-xs"
              />
            </div>
          </div>

          {/* Storage Location Assignment (Warehouse -> Rack -> Shelf) */}
          <div className="p-3 bg-[var(--surface-sunken)] rounded-md border border-[var(--border)] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--accent)]">
                <MapPin className="w-3.5 h-3.5" /> Storage Location (Rack &amp; Shelf)
              </div>
              <span className="text-[10px] text-[var(--text-secondary)]">
                Target: {warehouseId === 'wh_shop' ? 'Shop Floor' : 'Main Store'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Rack
                </label>
                <input
                  type="text"
                  value={rack}
                  onChange={(e) => setRack(e.target.value)}
                  placeholder="e.g. A, B, 1, 2"
                  className="w-full p-2 border border-[var(--border)] rounded-md text-xs bg-[var(--surface)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Shelf
                </label>
                <input
                  type="text"
                  value={shelf}
                  onChange={(e) => setShelf(e.target.value)}
                  placeholder="e.g. 1, 2, 3, Top"
                  className="w-full p-2 border border-[var(--border)] rounded-md text-xs bg-[var(--surface)]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                Landed Cost Per Unit (BDT)
              </label>
              <input
                type="number"
                min="1"
                value={landedCost}
                onChange={(e) => setLandedCost(Number(e.target.value))}
                className="w-full p-2 border border-[var(--border)] rounded-md font-mono font-bold text-xs"
              />
              <span className="text-[10px] text-[var(--text-secondary)]">
                Includes freight, customs &amp; duty
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                Supplier Name
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Supplier name"
                className="w-full p-2 border border-[var(--border)] rounded-md text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
              Shipment Notes / Reference
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dubai Invoice #1042 air freight"
              className="w-full p-2 border border-[var(--border)] rounded-md text-xs"
            />
          </div>

          {/* Point 2: Batch/lot + maturity — optional, never a hard sell-block */}
          <div className="p-3 bg-[var(--surface-sunken)] rounded-md border border-[var(--border)] space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--accent)]">
              <Sparkles className="w-3.5 h-3.5" /> Batch / Maturity Info (Optional)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Batch Code (Lot #)
                </label>
                <input
                  type="text"
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                  placeholder="e.g. 1042A"
                  className="w-full p-2 border border-[var(--border)] rounded-md text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Manufacturing Date
                </label>
                <input
                  type="date"
                  value={manufacturingDate}
                  onChange={(e) => setManufacturingDate(e.target.value)}
                  className="w-full p-2 border border-[var(--border)] rounded-md text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                Import Arrival Date
              </label>
              <input
                type="date"
                value={importDate}
                onChange={(e) => setImportDate(e.target.value)}
                className="w-full p-2 border border-[var(--border)] rounded-md text-xs"
              />
            </div>
          </div>

          {/* Damage on Arrival */}
          <div className="p-3 bg-[var(--surface-sunken)] rounded-md border border-[var(--border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-[var(--text)]">Damage on Arrival (Optional)</span>
              <span className="text-[10px] text-[var(--text-secondary)]">Auto-routed to damaged stock</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Damaged Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  max={qtyReceived}
                  value={qtyDamaged}
                  onChange={(e) => setQtyDamaged(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full p-2 border border-[var(--border)] rounded-md text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Damage Severity
                </label>
                <select
                  value={damageSeverity}
                  onChange={(e) => setDamageSeverity(e.target.value as any)}
                  className="w-full p-2 border border-[var(--border)] rounded-md text-xs"
                >
                  <option value="light">Light (Box dent only)</option>
                  <option value="medium">Medium (Bottle scratched / cap loose)</option>
                  <option value="heavy">Heavy (Broken bottle / leaking)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[var(--border)] rounded-md text-xs font-semibold hover:bg-[var(--surface-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-md text-xs font-semibold hover:opacity-90 cursor-pointer"
            >
              {isSubmitting ? 'Receiving...' : 'Confirm Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
