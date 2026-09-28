import React, { useMemo, useState } from "react";
import {
  Search,
  Star,
  Phone,
  MapPin,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  TrendingUp,
  User,
  MessageSquare,
  Package,
  Truck,
  Store,
  ChevronRight,
  Plus,
  FlaskConical,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { Customer, Order } from "../../types";
import { Modal } from "../common/Modal";
import { PageHeader } from "../common/PageHeader";

// ─── Star rating component ────────────────────────────────────────────────────
const StarRating: React.FC<{
  rating: number;
  onChange?: (r: number) => void;
  size?: "sm" | "md";
}> = ({ rating, onChange, size = "md" }) => {
  const [hovered, setHovered] = useState<number>(0);
  const sz = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange && onChange(n)}
          onMouseEnter={() => onChange && setHovered(n)}
          onMouseLeave={() => onChange && setHovered(0)}
          className={`${onChange ? "cursor-pointer" : "cursor-default"} transition-colors`}
          style={{ background: "none", border: "none", padding: 0 }}
        >
          <Star
            className={`${sz} ${
              n <= (hovered || Math.round(rating))
                ? "fill-[var(--accent-secondary)] text-[var(--accent-secondary)]"
                : "text-[var(--border)] fill-[var(--border)]"
            }`}
          />
        </button>
      ))}
      <span className="ml-1 text-[11px] font-bold font-num text-[var(--text-secondary)]">
        {rating.toFixed(1)}
      </span>
    </div>
  );
};

// ─── Status pill helper ───────────────────────────────────────────────────────
const Pill: React.FC<{ color: "green" | "amber" | "red" | "teal" | "gray"; children: React.ReactNode }> = ({ color, children }) => {
  const cls = {
    green: "pill-green",
    amber: "pill-amber",
    red: "pill-red",
    teal: "pill-teal",
    gray: "pill-gray",
  }[color];
  return (
    <span className={`${cls} inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border`}>
      {children}
    </span>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export const CustomersView: React.FC = () => {
  const { customers, orders } = useApp();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [riskFilter, setRiskFilter] = useState<"all" | "risk" | "reliable">("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "history" | "addresses" | "notes" | "risk">("summary");

  // Local session ratings \u2014 in a real impl these would be persisted via API
  const [ratings, setRatings] = useState<Record<string, number>>({});

  // ── Compute per-customer derived stats ─────────────────────────────────────
  const getStats = (cust: Customer) => {
    const custOrders = orders.filter(
      (o) =>
        o.customer_id === cust.id ||
        o.customer_phone.replace(/\D/g, "") === cust.phone.replace(/\D/g, "")
    );
    const delivered = custOrders.filter((o) => o.status === "delivered").length;
    const cancelled = custOrders.filter((o) => o.status === "cancelled").length;
    const rto = custOrders.filter((o) => o.status === "returned").length;
    const pending = custOrders.filter((o) =>
      ["confirmed", "packed", "dispatched"].includes(o.status)
    ).length;
    const total = custOrders.length || cust.order_count || 1;
    const outcomes = delivered + cancelled + rto;
    const successRate = outcomes > 0 ? Math.round((delivered / outcomes) * 100) : null;
    const totalSpent =
      custOrders
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + o.total, 0) || cust.total_spent;
    const avgOrderValue =
      delivered > 0 ? Math.round(totalSpent / Math.max(1, delivered)) : 0;
    const messengerOrders = custOrders.filter((o) => o.channel === "messenger").length;
    const walkinOrders = custOrders.filter((o) => o.channel === "walk-in").length;
    const preferredChannel =
      messengerOrders >= walkinOrders ? "Messenger" : "Walk-in Showroom";
    const steadfastOrders = custOrders.filter(
      (o) => o.fulfillment_method === "steadfast"
    ).length;
    const inHouseOrders = custOrders.filter(
      (o) => o.fulfillment_method === "in_house"
    ).length;
    const preferredFulfillment =
      steadfastOrders >= inHouseOrders ? "Steadfast COD" : "In-house Delivery";
    return {
      custOrders,
      total,
      delivered,
      cancelled,
      rto,
      pending,
      successRate,
      totalSpent,
      avgOrderValue,
      preferredChannel,
      preferredFulfillment,
      isRisk:
        cust.risk_flag ||
        (rto + cancelled >= 2 && (successRate ?? 100) < 50),
    };
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (riskFilter === "risk" && !c.risk_flag) return false;
      if (riskFilter === "reliable" && c.risk_flag) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.addresses.some((a) => a.address_text.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [customers, searchQuery, riskFilter]);

  const openCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setActiveTab("summary");
  };

  const selectedStats = selectedCustomer ? getStats(selectedCustomer) : null;
  const selectedRating =
    selectedCustomer
      ? (ratings[selectedCustomer.id] ??
          (selectedCustomer.risk_flag
            ? 2.5
            : (selectedStats?.successRate ?? 80) >= 90
            ? 5
            : (selectedStats?.successRate ?? 80) >= 70
            ? 4
            : 3))
      : 0;

  const tabs: { id: "summary" | "history" | "addresses" | "notes" | "risk"; label: string }[] = [
    { id: "summary", label: "Summary" },
    { id: "history", label: `Purchase History (${selectedStats?.custOrders.length ?? 0})` },
    { id: "addresses", label: "Addresses" },
    { id: "notes", label: "Notes & Testers" },
    { id: "risk", label: "Risk History" },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Customers"
        title="Customers"
        desc={`${customers.length} registered customers \u00B7 click any row to open full relationship workspace`}
        actions={
          <button className="erp-btn-primary">
            <Plus className="w-3.5 h-3.5" />
            Add Customer
          </button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="erp-input pl-8 w-72"
            placeholder="Search name, phone, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="erp-select"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as any)}
        >
          <option value="all">All Customers</option>
          <option value="reliable">Reliable Only</option>
          <option value="risk">RTO Risk Only</option>
        </select>
        <span className="ml-auto text-[11px] text-[var(--text-muted)] font-num">
          {filteredCustomers.length} results
        </span>
      </div>

      {/* Dense Table */}
      <div className="dense-table-container">
        <div className="overflow-x-auto">
          <table className="dense-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th className="text-center">Orders</th>
                <th className="text-center">Delivered</th>
                <th className="text-center">Success Rate</th>
                <th>Rating</th>
                <th className="text-right">Lifetime Spend</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--text-muted)]">
                    No customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const s = getStats(cust);
                  const rating = ratings[cust.id] ?? (cust.risk_flag ? 2.5 : s.successRate && s.successRate >= 90 ? 5 : s.successRate && s.successRate >= 70 ? 4 : 3);
                  const rateColor =
                    s.successRate === null
                      ? "status-gray"
                      : s.successRate >= 80
                      ? "status-green"
                      : s.successRate >= 60
                      ? "status-amber"
                      : "status-red";
                  return (
                    <tr
                      key={cust.id}
                      className="dense-table-row-clickable"
                      onClick={() => openCustomer(cust)}
                    >
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-[var(--text)]">{cust.name}</span>
                          {s.isRisk && <Pill color="red">Risk</Pill>}
                          {!s.isRisk && s.total >= 5 && <Pill color="teal">Returning</Pill>}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          {s.total} orders &#183; {s.custOrders.length > 0 ? "history in ERP" : "profile only"}
                        </div>
                      </td>
                      <td className="font-num text-[var(--accent)] font-semibold">{cust.phone}</td>
                      <td className="text-center font-num font-semibold">{s.total}</td>
                      <td className="text-center font-num font-semibold text-[var(--status-green)]">{s.delivered}</td>
                      <td className="text-center">
                        <span className={`font-num font-bold ${rateColor}`}>
                          {s.successRate !== null ? `${s.successRate}%` : "\u2014"}
                        </span>
                      </td>
                      <td>
                        <StarRating rating={rating} size="sm" />
                      </td>
                      <td className="text-right font-num font-semibold text-[var(--accent)]">
                        &#2547;{s.totalSpent.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Customer Record Workspace Modal ─────────────────────────────────── */}
      {selectedCustomer && selectedStats && (
        <Modal
          open={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          size="2xl"
          title={
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--accent)]" />
              <span>{selectedCustomer.name}</span>
              {selectedStats.isRisk && <Pill color="red">RTO Risk</Pill>}
            </div>
          }
          subtitle={`${selectedCustomer.phone} \u00B7 Customer since ${new Date(selectedCustomer.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`}
        >
          {/* Tab nav */}
          <div className="flex gap-0 border-b border-[var(--border)] mb-4 -mt-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 text-[11px] font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === t.id
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── TAB: Summary ─────────────────────────────────────────────── */}
          {activeTab === "summary" && (
            <div className="space-y-4">
              {/* Rating */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Customer Rating
                  </div>
                  <StarRating
                    rating={selectedRating}
                    onChange={(r) => setRatings((prev) => ({ ...prev, [selectedCustomer.id]: r }))}
                    size="md"
                  />
                </div>
                {selectedStats.isRisk && (
                  <div className="flex items-center gap-1.5 text-[var(--status-red)] text-[11px] font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    High RTO Risk
                  </div>
                )}
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Lifetime Spend", value: `\u09F3${selectedStats.totalSpent.toLocaleString()}`, color: "text-[var(--accent)]" },
                  { label: "Total Orders", value: selectedStats.total, color: "" },
                  { label: "Delivered", value: selectedStats.delivered, color: "text-[var(--status-green)]" },
                  { label: "Cancelled", value: selectedStats.cancelled, color: selectedStats.cancelled > 0 ? "text-[var(--status-amber)]" : "" },
                  { label: "RTO", value: selectedStats.rto, color: selectedStats.rto > 0 ? "text-[var(--status-red)]" : "" },
                  { label: "Pending", value: selectedStats.pending, color: "text-[var(--status-teal)]" },
                  { label: "Success Rate", value: selectedStats.successRate !== null ? `${selectedStats.successRate}%` : "\u2014", color: selectedStats.successRate && selectedStats.successRate >= 80 ? "text-[var(--status-green)]" : "text-[var(--status-amber)]" },
                  { label: "Avg Order Value", value: `\u09F3${selectedStats.avgOrderValue.toLocaleString()}`, color: "" },
                ].map((s, i) => (
                  <div key={i} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      {s.label}
                    </div>
                    <div className={`text-base font-bold font-num ${s.color || "text-[var(--text)]"}`}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Channel & fulfillment */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-[var(--border)]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Preferred Channel</div>
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                    {selectedStats.preferredChannel === "Messenger" ? (
                      <MessageSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
                    ) : (
                      <Store className="w-3.5 h-3.5 text-[var(--accent)]" />
                    )}
                    {selectedStats.preferredChannel}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border)]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Preferred Fulfillment</div>
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                    <Truck className="w-3.5 h-3.5 text-[var(--accent)]" />
                    {selectedStats.preferredFulfillment}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Purchase History ─────────────────────────────────────── */}
          {activeTab === "history" && (
            <div>
              {selectedStats.custOrders.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-muted)] text-sm">
                  No orders found in the ERP for this customer.
                </div>
              ) : (
                <div className="dense-table-container">
                  <div className="overflow-x-auto">
                    <table className="dense-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Order ID</th>
                          <th>Products</th>
                          <th className="text-right">Total</th>
                          <th>Channel</th>
                          <th>Fulfillment</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...selectedStats.custOrders]
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((o) => {
                            const statusColor =
                              o.status === "delivered"
                                ? "green"
                                : o.status === "dispatched"
                                ? "teal"
                                : o.status === "cancelled" || o.status === "returned"
                                ? "red"
                                : "amber";
                            return (
                              <tr key={o.id}>
                                <td className="font-num text-[var(--text-muted)] whitespace-nowrap">
                                  {new Date(o.created_at).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "2-digit",
                                  })}
                                </td>
                                <td className="font-num font-semibold text-[var(--accent)] whitespace-nowrap">
                                  {o.invoice_number}
                                </td>
                                <td>
                                  {o.items.map((it, idx) => (
                                    <div key={idx} className="text-[11px] leading-snug">
                                      <span className="font-semibold">{it.product_name}</span>
                                      <span className="text-[var(--text-muted)]"> × {it.quantity}</span>
                                      <span className="font-num text-[var(--text-muted)] ml-1">
                                        &#2547;{it.unit_price.toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                  {o.delivery_charge > 0 && (
                                    <div className="text-[10px] text-[var(--text-muted)]">
                                      + &#2547;{o.delivery_charge} delivery
                                    </div>
                                  )}
                                </td>
                                <td className="text-right font-num font-bold text-[var(--accent)] whitespace-nowrap">
                                  &#2547;{o.total.toLocaleString()}
                                </td>
                                <td className="capitalize text-[var(--text-muted)]">{o.channel}</td>
                                <td className="capitalize text-[var(--text-muted)]">
                                  {o.fulfillment_method?.replace("_", "-") ?? "\u2014"}
                                </td>
                                <td>
                                  <Pill color={statusColor as any}>
                                    {o.status}
                                  </Pill>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Addresses ───────────────────────────────────────────── */}
          {activeTab === "addresses" && (
            <div className="space-y-2">
              {selectedCustomer.addresses.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                  No addresses saved.
                </div>
              ) : (
                selectedCustomer.addresses.map((a, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]"
                  >
                    <MapPin className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="text-[12px] text-[var(--text)]">{a.address_text}</div>
                      {(a.is_default || a.is_primary) && (
                        <Pill color="teal" >Default</Pill>
                      )}
                    </div>
                  </div>
                ))
              )}
              <button className="erp-btn-secondary w-full mt-2">
                <Plus className="w-3.5 h-3.5" />
                Add Address
              </button>
            </div>
          )}

          {/* ── TAB: Notes & Testers ─────────────────────────────────────── */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  Customer Notes
                </div>
                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[12px] text-[var(--text-muted)] italic">
                  No notes yet &#8212; add observations about this customer here.
                </div>
                <button className="erp-btn-secondary mt-2">
                  <Plus className="w-3.5 h-3.5" />
                  Add Note
                </button>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  Complimentary Tester History
                </div>
                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[12px] text-[var(--text-muted)] italic">
                  No complimentary testers recorded for this customer.
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Risk History ─────────────────────────────────────────── */}
          {activeTab === "risk" && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 p-3 rounded-lg border ${selectedStats.isRisk ? "border-[var(--status-red)]/30 bg-[var(--status-red)]/5" : "border-[var(--border)] bg-[var(--surface-sunken)]"}`}>
                {selectedStats.isRisk ? (
                  <AlertTriangle className="w-4 h-4 text-[var(--status-red)] shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[var(--status-green)] shrink-0" />
                )}
                <div className="text-[12px] font-semibold text-[var(--text)]">
                  {selectedStats.isRisk
                    ? "This customer has a high RTO / cancellation rate. Use caution for COD orders."
                    : "No risk flags \u2014 this customer has a good delivery track record."}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-[var(--border)] text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">RTO Count</div>
                  <div className={`text-xl font-bold font-num ${selectedStats.rto > 0 ? "text-[var(--status-red)]" : "text-[var(--text)]"}`}>{selectedStats.rto}</div>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border)] text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Cancelled</div>
                  <div className={`text-xl font-bold font-num ${selectedStats.cancelled > 0 ? "text-[var(--status-amber)]" : "text-[var(--text)]"}`}>{selectedStats.cancelled}</div>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border)] text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Success Rate</div>
                  <div className={`text-xl font-bold font-num ${selectedStats.successRate && selectedStats.successRate >= 70 ? "text-[var(--status-green)]" : "text-[var(--status-red)]"}`}>
                    {selectedStats.successRate !== null ? `${selectedStats.successRate}%` : "\u2014"}
                  </div>
                </div>
              </div>

              {selectedStats.rto > 0 && (
                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">RTO Orders</div>
                  {selectedStats.custOrders
                    .filter((o) => o.status === "returned")
                    .map((o) => (
                      <div key={o.id} className="text-[11px] text-[var(--text)] py-1 border-b border-[var(--border)] last:border-0">
                        <span className="font-num font-semibold text-[var(--accent)]">{o.invoice_number}</span>
                        <span className="text-[var(--text-muted)] ml-2">
                          {new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                        <span className="ml-2">&#2547;{o.total.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
