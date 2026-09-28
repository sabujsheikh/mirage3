import React, { useMemo, useState } from "react";
import {
  Search,
  Plus,
  X,
  ExternalLink,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { StockMovement, StockMovementReason, Order } from "../../types";
import { PageHeader } from "../common/PageHeader";
import { Modal } from "../common/Modal";
import { OrderWorkspaceModal } from "../orders/OrderWorkspaceModal";

export const StockLedgerView: React.FC = () => {
  const { stockMovements, products, postMovement, orders, setActivePath } = useApp();
  const { can } = useAuth();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");

  // Detail Modal State
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Adjustment Modal State
  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [selectedProdId, setSelectedProdId] = useState<string>(products[0]?.id || "");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("wh_shop");
  const [adjReason, setAdjReason] = useState<StockMovementReason>("DAMAGE");
  const [adjQuantity, setAdjQuantity] = useState<number>(1);
  const [adjNotes, setAdjNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Precalculate running balances (Stock Before & Balance After) per movement
  const movementBalances = useMemo(() => {
    const sorted = [...stockMovements].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const productBalances: Record<string, number> = {};
    const balanceMap = new Map<string, { stockBefore: number; stockAfter: number }>();

    sorted.forEach((m) => {
      const prodId = m.product_id;
      const currentBal = productBalances[prodId] || 0;
      const nextBal = currentBal + m.quantity_delta;

      productBalances[prodId] = nextBal;
      balanceMap.set(m.id, {
        stockBefore: currentBal,
        stockAfter: nextBal,
      });
    });

    return balanceMap;
  }, [stockMovements]);

  // Date filtering logic
  const matchDate = (dateStr: string) => {
    if (dateFilter === "all") return true;
    const d = new Date(dateStr);
    const now = new Date();

    if (dateFilter === "today") {
      return d.toDateString() === now.toDateString();
    }
    if (dateFilter === "yesterday") {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      return d.toDateString() === yest.toDateString();
    }
    if (dateFilter === "last_7") {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 7);
      return d >= past7;
    }
    if (dateFilter === "last_30") {
      const past30 = new Date(now);
      past30.setDate(now.getDate() - 30);
      return d >= past30;
    }
    if (dateFilter === "this_month") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (dateFilter === "custom") {
      if (customDateFrom && new Date(dateStr) < new Date(customDateFrom)) return false;
      if (customDateTo) {
        const toDate = new Date(customDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(dateStr) > toDate) return false;
      }
      return true;
    }
    return true;
  };

  const filteredMovements = useMemo(() => {
    return stockMovements.filter((m) => {
      if (reasonFilter !== "all" && m.movement_reason !== reasonFilter) return false;
      if (warehouseFilter !== "all" && m.warehouse_id !== warehouseFilter) return false;
      if (!matchDate(m.created_at)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = m.product_name.toLowerCase();
        const mSku = m.sku.toLowerCase();
        const mNotes = (m.notes || "").toLowerCase();
        const mRef = (m.reference_id || "").toLowerCase();
        if (!mName.includes(q) && !mSku.includes(q) && !mNotes.includes(q) && !mRef.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [stockMovements, reasonFilter, warehouseFilter, dateFilter, customDateFrom, customDateTo, searchQuery]);

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProdId || adjQuantity <= 0) {
      setErrorMsg("Please select a product and valid positive quantity.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const isOutflow = [
        "SALE",
        "DAMAGE",
        "LOSS",
        "MARKETING_SAMPLE",
        "GIFT",
        "TESTER_CONVERSION",
      ].includes(adjReason);

      const delta = isOutflow ? -Math.abs(adjQuantity) : Math.abs(adjQuantity);

      await postMovement({
        product_id: selectedProdId,
        warehouse_id: selectedWarehouseId,
        quantity_delta: delta,
        movement_reason: adjReason,
        notes: adjNotes || `Manual movement: ${adjReason}`,
      });

      setSuccessMsg(`Successfully logged stock movement (${adjReason}).`);
      setTimeout(() => {
        setShowAdjustModal(false);
        setSuccessMsg(null);
        setAdjNotes("");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to post movement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReasonPillClass = (reason: StockMovementReason) => {
    switch (reason) {
      case "PURCHASE":
      case "OPENING_BALANCE":
      case "PO_RECEIVING":
        return "pill-green";
      case "SALE":
        return "pill-gray";
      case "TRANSFER":
        return "pill-teal";
      case "DAMAGE":
      case "LOSS":
      case "DAMAGED_WRITE_OFF":
        return "pill-red";
      case "TESTER_CONVERSION":
      case "MARKETING_SAMPLE":
      case "GIFT":
        return "pill-amber";
      case "RETURN":
      case "RETURN_RESTOCK":
        return "pill-teal";
      default:
        return "pill-gray";
    }
  };

  const getReasonLabel = (reason: StockMovementReason): string => {
    switch (reason) {
      case "PURCHASE":
        return "Purchase";
      case "PO_RECEIVING":
        return "PO Receiving";
      case "SALE":
        return "Sale";
      case "TRANSFER":
        return "Transfer";
      case "DAMAGE":
        return "Damage";
      case "LOSS":
        return "Loss";
      case "DAMAGED_WRITE_OFF":
        return "Damaged Write-off";
      case "TESTER_CONVERSION":
        return "Tester Conversion";
      case "MARKETING_SAMPLE":
        return "Marketing Sample";
      case "GIFT":
        return "VIP Gift";
      case "RETURN":
      case "RETURN_RESTOCK":
        return "Return Restocked";
      case "OPENING_BALANCE":
        return "Opening Balance";
      case "PURCHASE_RETURN":
        return "Purchase Return";
      case "ADJUSTMENT":
        return "Audit Adjustment";
      default:
        return String(reason || "").replace(/_/g, " ");
    }
  };

  const isClickableRef = (refId?: string) => {
    if (!refId) return false;
    const trimmed = refId.trim();
    if (orders.some((o) => o.id === trimmed || o.invoice_number === trimmed)) return true;
    if (
      trimmed.startsWith("PO-") ||
      trimmed.startsWith("PUR-") ||
      trimmed.startsWith("TRF-") ||
      trimmed.startsWith("RET-") ||
      trimmed.startsWith("RTO-")
    ) {
      return true;
    }
    return false;
  };

  const handleReferenceClick = (e: React.MouseEvent, refId: string) => {
    e.stopPropagation();
    const trimmed = refId.trim();

    const matchedOrder = orders.find(
      (o) => o.id === trimmed || o.invoice_number === trimmed
    );
    if (matchedOrder) {
      setSelectedOrder(matchedOrder);
      return;
    }

    if (trimmed.startsWith("PO-") || trimmed.startsWith("PUR-")) {
      setActivePath("/purchasing/orders");
      return;
    }

    if (trimmed.startsWith("TRF-")) {
      setActivePath("/inventory/transfer");
      return;
    }

    if (trimmed.startsWith("RET-") || trimmed.startsWith("RTO-")) {
      setActivePath("/returns");
      return;
    }
  };

  const selectedBal = selectedMovement ? movementBalances.get(selectedMovement.id) : null;
  const selectedProduct = selectedMovement ? products.find((p) => p.id === selectedMovement.product_id) : null;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Inventory"
        title="Stock Movements"
        actions={
          can("adjust_stock") ? (
            <button
              type="button"
              onClick={() => setShowAdjustModal(true)}
              className="erp-btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Movement</span>
            </button>
          ) : undefined
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product, SKU, ref..."
            className="erp-input pl-8 w-60 text-xs"
          />
        </div>

        {/* Date Filter */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="erp-select text-xs"
        >
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last_7">Last 7 Days</option>
          <option value="last_30">Last 30 Days</option>
          <option value="this_month">This Month</option>
          <option value="custom">Custom Range</option>
        </select>

        {dateFilter === "custom" && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              className="erp-input text-xs py-1 px-2"
            />
            <span className="text-[var(--text-muted)] text-xs">to</span>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => setCustomDateTo(e.target.value)}
              className="erp-input text-xs py-1 px-2"
            />
          </div>
        )}

        {/* Movement Reason Filter */}
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="erp-select text-xs"
        >
          <option value="all">All Movement Reasons</option>
          <option value="PURCHASE">PURCHASE (Shipment In)</option>
          <option value="SALE">SALE (Order / POS)</option>
          <option value="TRANSFER">TRANSFER (Inter-wh)</option>
          <option value="DAMAGE">DAMAGE (Broken bottle)</option>
          <option value="LOSS">LOSS (Shrinkage / Theft)</option>
          <option value="TESTER_CONVERSION">TESTER CONVERSION</option>
          <option value="MARKETING_SAMPLE">MARKETING / PR SAMPLE</option>
          <option value="GIFT">VIP GIFT</option>
          <option value="RETURN">RETURN (Restocked)</option>
          <option value="OPENING_BALANCE">OPENING BALANCE</option>
          <option value="ADJUSTMENT">AUDIT ADJUSTMENT</option>
        </select>

        {/* Warehouse Filter */}
        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="erp-select text-xs"
        >
          <option value="all">All Warehouses</option>
          <option value="wh_shop">Shop Floor (Showroom)</option>
          <option value="wh_main">Main / Back-store</option>
        </select>

        <span className="ml-auto text-[11px] text-[var(--text-muted)] font-num">
          {filteredMovements.length} movements
        </span>
      </div>

      {/* Movement Ledger Table */}
      <div className="dense-table-container">
        <div className="overflow-x-auto">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th className="text-left py-2.5 px-3 w-36 whitespace-nowrap">Date / Time</th>
                <th className="text-left py-2.5 px-3 min-w-[200px]">Product / SKU</th>
                <th className="text-center py-2.5 px-3 w-36">Warehouse</th>
                <th className="text-center py-2.5 px-3 w-40">Movement Type</th>
                <th className="text-center py-2.5 px-3 w-24">Qty Delta</th>
                <th className="text-right py-2.5 px-3 w-28">Balance After</th>
                <th className="text-right py-2.5 px-3 w-28">Unit Cost</th>
                <th className="text-right py-2.5 px-3 w-28">Total Impact</th>
                <th className="text-left py-2.5 px-3 min-w-[180px]">Reference &amp; Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-[var(--text-muted)] text-xs">
                    No stock movements recorded matching filters.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isPositive = m.quantity_delta > 0;
                  const bal = movementBalances.get(m.id);
                  const isRefLink = isClickableRef(m.reference_id);

                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMovement(m)}
                      className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                    >
                      {/* Timestamp */}
                      <td className="text-left py-2.5 px-3 whitespace-nowrap font-num text-xs text-[var(--text-secondary)] align-middle">
                        {new Date(m.created_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Product & SKU */}
                      <td className="text-left py-2.5 px-3 align-middle">
                        <div className="font-semibold text-xs text-[var(--text)] leading-snug">
                          {m.product_name}
                        </div>
                        <div className="font-num text-[11px] text-[var(--accent)] mt-0.5">
                          SKU: {m.sku}
                        </div>
                      </td>

                      {/* Warehouse Badge (Properly centered & styled) */}
                      <td className="text-center py-2.5 px-3 align-middle">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-[var(--surface-sunken)] border border-[var(--border)] text-[11px] font-medium text-[var(--text)] whitespace-nowrap text-center">
                          {m.warehouse_name}
                        </span>
                      </td>

                      {/* Movement Type Badge (Uniform height, padding, and centered text) */}
                      <td className="text-center py-2.5 px-3 align-middle">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap text-center ${getReasonPillClass(
                            m.movement_reason
                          )}`}
                        >
                          {getReasonLabel(m.movement_reason)}
                        </span>
                      </td>

                      {/* Quantity Delta Badge */}
                      <td className="text-center py-2.5 px-3 align-middle">
                        <span
                          className={`inline-flex items-center justify-center min-w-[38px] px-2 py-0.5 rounded font-num font-bold text-xs ${
                            isPositive
                              ? "text-[var(--status-green)] bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)]"
                              : "text-[var(--status-red)] bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)]"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {m.quantity_delta}
                        </span>
                      </td>

                      {/* Balance After */}
                      <td className="text-right py-2.5 px-3 font-num font-bold text-xs text-[var(--text)] align-middle">
                        {bal !== undefined ? bal.stockAfter : "—"}
                      </td>

                      {/* Unit Valuation */}
                      <td className="text-right py-2.5 px-3 font-num text-xs text-[var(--text-secondary)] align-middle">
                        {can("view_cost_margin") ? `৳${m.unit_cost.toLocaleString()}` : "••••"}
                      </td>

                      {/* Total Impact */}
                      <td className="text-right py-2.5 px-3 font-num font-semibold text-xs text-[var(--accent)] align-middle">
                        {can("view_cost_margin")
                          ? `৳${Math.abs(m.total_cost).toLocaleString()}`
                          : "••••"}
                      </td>

                      {/* Reference / Notes */}
                      <td className="text-left py-2.5 px-3 text-xs align-middle max-w-xs">
                        {m.reference_id && (
                          <div className="font-num font-semibold truncate leading-snug">
                            {isRefLink ? (
                              <button
                                type="button"
                                onClick={(e) => handleReferenceClick(e, m.reference_id!)}
                                className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline cursor-pointer"
                              >
                                <span>Ref: {m.reference_id}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ) : (
                              <span className="text-[var(--text-secondary)]">Ref: {m.reference_id}</span>
                            )}
                          </div>
                        )}
                        <div className="text-[11px] text-[var(--text-muted)] truncate leading-snug">
                          {m.notes || "—"}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement Detail View Modal */}
      {selectedMovement && (
        <Modal
          open={!!selectedMovement}
          onClose={() => setSelectedMovement(null)}
          title="Stock Movement Details"
          size="lg"
        >
          <div className="p-4 space-y-4">
            {/* Header info */}
            <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-sm text-[var(--text)]">
                  {selectedMovement.product_name}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-secondary)] font-mono">
                  <span>SKU: {selectedMovement.sku}</span>
                  {selectedProduct?.barcode && <span>· Barcode: {selectedProduct.barcode}</span>}
                  {selectedProduct?.size_variant && <span>· {selectedProduct.size_variant}</span>}
                </div>
              </div>
              <span
                className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold border shrink-0 ${getReasonPillClass(
                  selectedMovement.movement_reason
                )}`}
              >
                {getReasonLabel(selectedMovement.movement_reason)}
              </span>
            </div>

            {/* 4 Primary Movement Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
                <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">
                  Quantity Delta
                </div>
                <div
                  className={`text-lg font-bold font-num mt-1 ${
                    selectedMovement.quantity_delta > 0
                      ? "text-[var(--status-green)]"
                      : "text-[var(--status-red)]"
                  }`}
                >
                  {selectedMovement.quantity_delta > 0 ? "+" : ""}
                  {selectedMovement.quantity_delta}
                </div>
              </div>

              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
                <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">
                  Stock Before
                </div>
                <div className="text-lg font-bold font-num text-[var(--text)] mt-1">
                  {selectedBal?.stockBefore ?? "—"}
                </div>
              </div>

              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
                <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">
                  Stock After
                </div>
                <div className="text-lg font-bold font-num text-[var(--accent)] mt-1">
                  {selectedBal?.stockAfter ?? "—"}
                </div>
              </div>

              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
                <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">
                  Warehouse
                </div>
                <div className="text-xs font-bold text-[var(--text)] mt-2 truncate">
                  {selectedMovement.warehouse_name}
                </div>
              </div>
            </div>

            {/* Additional Attributes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Date &amp; Time:</span>
                  <span className="font-num font-semibold text-[var(--text)]">
                    {new Date(selectedMovement.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Logged By:</span>
                  <span className="font-semibold text-[var(--text)]">
                    {selectedMovement.created_by_name || "System"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Reference:</span>
                  {selectedMovement.reference_id ? (
                    isClickableRef(selectedMovement.reference_id) ? (
                      <button
                        type="button"
                        onClick={(e) => handleReferenceClick(e, selectedMovement.reference_id!)}
                        className="inline-flex items-center gap-1 font-bold text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        <span>{selectedMovement.reference_id}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="font-mono font-semibold text-[var(--text)]">
                        {selectedMovement.reference_id}
                      </span>
                    )
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] space-y-2">
                {can("view_cost_margin") ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Unit Landed Cost:</span>
                      <span className="font-num font-semibold text-[var(--text)]">
                        ৳{selectedMovement.unit_cost.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Total Inventory Impact:</span>
                      <span className="font-num font-bold text-[var(--accent)]">
                        ৳{Math.abs(selectedMovement.total_cost).toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-[var(--text-muted)] italic">
                    Valuation details restricted
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Movement ID:</span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                    {selectedMovement.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] space-y-1">
              <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">
                Audit Notes &amp; Explanation
              </div>
              <div className="text-xs text-[var(--text)] whitespace-pre-wrap">
                {selectedMovement.notes || "No additional audit notes recorded."}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedMovement(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] text-[var(--text)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Referenced Order Workspace Modal */}
      {selectedOrder && (
        <OrderWorkspaceModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* Manual Movement Modal */}
      {showAdjustModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(22, 50, 79, 0.10)" }}
          onClick={() => setShowAdjustModal(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl shadow-xl max-w-md w-full p-5 border border-[var(--border)] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text)]">Record Stock Movement</h3>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_25%,transparent)] text-[var(--status-red)] rounded-lg text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-green)_25%,transparent)] text-[var(--status-green)] rounded-lg text-xs font-semibold">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleCreateAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Select Product SKU
                </label>
                <select
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  className="erp-select w-full font-medium"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.display_name} (Cost: ৳{p.avg_cost})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Warehouse
                  </label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="erp-select w-full"
                  >
                    <option value="wh_shop">Shop Floor (Showroom)</option>
                    <option value="wh_main">Main / Back-store</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Movement Reason
                  </label>
                  <select
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value as StockMovementReason)}
                    className="erp-select w-full font-semibold"
                  >
                    <option value="DAMAGE">DAMAGE (Broken bottle)</option>
                    <option value="LOSS">LOSS (Shrinkage / Unaccounted)</option>
                    <option value="TESTER_CONVERSION">TESTER CONVERSION (Showroom display)</option>
                    <option value="MARKETING_SAMPLE">MARKETING / PR SAMPLE (Influencer)</option>
                    <option value="GIFT">VIP COMPLIMENTARY GIFT</option>
                    <option value="ADJUSTMENT">AUDIT STOCK ADJUSTMENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Quantity (Units)
                </label>
                <input
                  type="number"
                  min="1"
                  value={adjQuantity}
                  onChange={(e) => setAdjQuantity(Number(e.target.value))}
                  className="erp-input w-full font-num font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Audit Notes / Reason Description
                </label>
                <textarea
                  rows={2}
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  placeholder="Audit reason..."
                  className="erp-input w-full resize-none text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="erp-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="erp-btn-primary"
                >
                  {isSubmitting ? "Posting..." : "Record Movement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
