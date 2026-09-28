import React, { useState } from "react";
import { ArrowLeftRight, CheckCircle2, AlertCircle, Sparkles, Warehouse } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { PageHeader } from "../common/PageHeader";

export const StockTransferView: React.FC = () => {
  const { products, transferStock } = useApp();
  const { can } = useAuth();

  const [fromWarehouseId, setFromWarehouseId] = useState<string>("wh_main");
  const [toWarehouseId, setToWarehouseId] = useState<string>("wh_shop");
  const [productId, setProductId] = useState<string>(products[0]?.id || "");
  const [quantity, setQuantity] = useState<number>(5);
  const [notes, setNotes] = useState<string>("Replenishment for daily showroom sales");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedProd = products.find((p) => p.id === productId);
  const fromWh = selectedProd?.stock_by_warehouse?.find((w) => w.warehouse_id === fromWarehouseId);
  const availableInSource = fromWh?.available ?? 0;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromWarehouseId === toWarehouseId) {
      setErrorMsg("Source and destination warehouses cannot be the same.");
      return;
    }
    if (quantity <= 0) {
      setErrorMsg("Please specify a positive transfer quantity.");
      return;
    }
    if (quantity > availableInSource) {
      setErrorMsg(`Cannot transfer ${quantity} units \u2014 only ${availableInSource} available in source warehouse.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await transferStock({
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        product_id: productId,
        quantity,
        notes,
      });

      setSuccessMsg(`Successfully transferred ${quantity} units of ${selectedProd?.display_name} to destination warehouse.`);
      setTimeout(() => {
        setSuccessMsg(null);
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || "Transfer failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Inventory"
        title="Stock Transfer"
        desc="Transfer stock safely between Main Back-store (2nd Floor) and Shop Floor (Showroom)"
      />

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
        {errorMsg && (
          <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_25%,transparent)] text-[var(--status-red)] rounded-lg text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-green)_25%,transparent)] text-[var(--status-green)] rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleTransfer} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Select Perfume SKU
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="erp-select w-full font-medium"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.display_name} (Total on hand: {p.stock_on_hand} units)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Source Warehouse (From)
              </label>
              <select
                value={fromWarehouseId}
                onChange={(e) => setFromWarehouseId(e.target.value)}
                className="erp-select w-full font-semibold"
              >
                <option value="wh_main">Main / Back-store (2nd Floor)</option>
                <option value="wh_shop">Shop Floor (Showroom)</option>
              </select>
              <div className="text-[11px] text-[var(--text-muted)]">
                Available here: <strong className="text-[var(--accent)] font-num">{availableInSource} units</strong>
              </div>
            </div>

            <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Destination Warehouse (To)
              </label>
              <select
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                className="erp-select w-full font-semibold"
              >
                <option value="wh_shop">Shop Floor (Showroom)</option>
                <option value="wh_main">Main / Back-store (2nd Floor)</option>
              </select>
              <div className="text-[11px] text-[var(--text-muted)]">
                Replenish target location inventory
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Transfer Quantity (Units)
            </label>
            <input
              type="number"
              min="1"
              max={availableInSource}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="erp-input w-full font-num font-bold text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Transfer Note / Authorization Reference
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="erp-input w-full text-xs"
            />
          </div>

          <div className="flex justify-end pt-2 border-t border-[var(--border)]">
            <button
              type="submit"
              disabled={isSubmitting || quantity <= 0 || quantity > availableInSource}
              className="erp-btn-primary"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Execute Inter-Warehouse Transfer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
