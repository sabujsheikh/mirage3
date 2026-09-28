import React, { useState } from "react";
import {
  Truck,
  Search,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  Scale,
  MapPin,
  Terminal,
  Settings2,
  Play,
  Copy,
  Eye,
  Check,
  Zap,
  Radio,
  X,
  Package,
  Calendar,
  Pencil,
  AlertTriangle,
  History,
  FileText,
  ShieldAlert,
  Layers,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { CourierBooking, CourierBookingStatus, CourierWebhookLog } from "../../types";
import { PageHeader } from "../common/PageHeader";
import { Modal } from "../common/Modal";
import { CourierSettlementBatchesTab } from "./CourierSettlementBatchesTab";

export const CourierBookingsView: React.FC = () => {
  const {
    courierBookings,
    reconciliationSummary,
    courierWebhookLogs,
    courierApiConfig,
    syncCourierStatus,
    reconcileCourierPayout,
    calculateCourierCharge,
    syncAllCourierBookings,
    simulateCourierWebhook,
    updateCourierApiConfig,
    testCourierApiConnection,
    updateCourierActualChargeManual,
    resolveCourierChargeConflict,
    refreshAll,
    accounts,
  } = useApp();
  const { currentUser, can } = useAuth();

  const [activeTab, setActiveTab] = useState<"bookings" | "batches" | "webhooks" | "config">("bookings");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [payoutFilter, setPayoutFilter] = useState<string>("all");
  const [chargeFilter, setChargeFilter] = useState<string>("all"); // 'all' | 'confirmed' | 'pending' | 'conflict'
  const [selectedBooking, setSelectedBooking] = useState<CourierBooking | null>(null);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [isSyncingBatch, setIsSyncingBatch] = useState(false);

  // Manual Actual Charge Modal State
  const [isManualChargeModalOpen, setIsManualChargeModalOpen] = useState(false);
  const [editingChargeBooking, setEditingChargeBooking] = useState<CourierBooking | null>(null);
  const [manualChargeValue, setManualChargeValue] = useState<number>(60);
  const [manualChargeNotes, setManualChargeNotes] = useState<string>("");
  const [isSavingManualCharge, setIsSavingManualCharge] = useState(false);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  // Webhook Simulator State
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);
  const [simConsignment, setSimConsignment] = useState("");
  const [simStatus, setSimStatus] = useState("delivered");
  const [simActualCharge, setSimActualCharge] = useState<number>(60);
  const [simCod, setSimCod] = useState<number>(3370);
  const [simNotes, setSimNotes] = useState("Delivered via local delivery rider");
  const [simResponse, setSimResponse] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Webhook Detail Modal State
  const [selectedLog, setSelectedLog] = useState<CourierWebhookLog | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  // Carrier Config State
  const [apiKey, setApiKey] = useState(courierApiConfig?.api_key || "demo-api-key");
  const [secretKey, setSecretKey] = useState(courierApiConfig?.secret_key || "demo-secret-key");
  const [baseUrl, setBaseUrl] = useState(courierApiConfig?.base_url || "https://portal.steadfast.com.bd/api/v1");
  const [webhookSecret, setWebhookSecret] = useState(courierApiConfig?.webhook_secret || "");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(courierApiConfig?.auto_sync_enabled ?? false);
  const [autoSyncInterval, setAutoSyncInterval] = useState(courierApiConfig?.auto_sync_interval_minutes || 30);
  const [configTestResult, setConfigTestResult] = useState<any>(null);
  const [isTestingConfig, setIsTestingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  React.useEffect(() => {
    if (courierApiConfig) {
      if (courierApiConfig.api_key) setApiKey(courierApiConfig.api_key);
      if (courierApiConfig.secret_key) setSecretKey(courierApiConfig.secret_key);
      if (courierApiConfig.base_url) setBaseUrl(courierApiConfig.base_url);
      if (courierApiConfig.webhook_secret !== undefined) setWebhookSecret(courierApiConfig.webhook_secret);
      if (courierApiConfig.auto_sync_enabled !== undefined) setAutoSyncEnabled(courierApiConfig.auto_sync_enabled);
      if (courierApiConfig.auto_sync_interval_minutes) setAutoSyncInterval(courierApiConfig.auto_sync_interval_minutes);
    }
  }, [courierApiConfig]);

  // Reconciliation form state
  const [reconPayoutAmount, setReconPayoutAmount] = useState<number>(0);
  const [reconActualCharge, setReconActualCharge] = useState<number>(60);
  const [reconAccountId, setReconAccountId] = useState<string>("acc_bank");
  const [reconNotes, setReconNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Rate calculator state
  const [calcAddress, setCalcAddress] = useState<string>("");
  const [calcWeight, setCalcWeight] = useState<number>(500);
  const [calcResult, setCalcResult] = useState<{ zone: string; actualFee: number } | null>(null);

  // Computed metrics
  const totalBookings = courierBookings.length;
  const deliveredBookings = courierBookings.filter((b) => b.status === "delivered");
  const rtoBookings = courierBookings.filter((b) => b.status === "rto");
  const activeBookings = courierBookings.filter((b) => ["in_transit", "booked", "pending"].includes(b.status));

  const deliverySuccessRate = totalBookings > 0 ? Math.round((deliveredBookings.length / totalBookings) * 100) : 100;
  const rtoRate = totalBookings > 0 ? Math.round((rtoBookings.length / totalBookings) * 100) : 0;

  // Confirmed vs Pending Actual Charges (Directive: Never treat estimated charge as actual charge)
  const confirmedBookings = courierBookings.filter((b) => b.actual_charge != null);
  const pendingActualCount = courierBookings.filter((b) => b.actual_charge == null).length;
  const conflictCount = courierBookings.filter((b) => b.pending_api_conflict != null).length;

  // Real Same-day calculation from booking vs delivery timestamps
  const sameDayDeliveredCount = deliveredBookings.filter((b) => {
    if (!b.created_at || !b.updated_at) return false;
    const bookDate = new Date(b.created_at).toDateString();
    const delivDate = new Date(b.updated_at).toDateString();
    return bookDate === delivDate;
  }).length;
  const sameDayRate = deliveredBookings.length > 0 ? Math.round((sameDayDeliveredCount / deliveredBookings.length) * 100) : 0;

  const totalCod = courierBookings.reduce((sum, b) => sum + b.cod_amount, 0);
  // Calculate variance ONLY across bookings where actual_charge is confirmed
  const totalActualSteadfast = confirmedBookings.reduce((sum, b) => sum + (b.actual_charge || 0), 0);
  const totalCustDeliveryConfirmed = confirmedBookings.reduce((sum, b) => sum + b.delivery_charge, 0);
  const netDeliveryVariance = totalCustDeliveryConfirmed - totalActualSteadfast;
  const courierReceivable = accounts.find((a) => a.id === "acc_courier_rec")?.balance || 0;

  const filteredBookings = courierBookings.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (zoneFilter !== "all" && b.delivery_zone !== zoneFilter) return false;
    if (payoutFilter !== "all" && b.payout_status !== payoutFilter) return false;
    if (chargeFilter === "confirmed" && b.actual_charge == null) return false;
    if (chargeFilter === "pending" && b.actual_charge != null) return false;
    if (chargeFilter === "conflict" && !b.pending_api_conflict) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchInv = b.invoice_number.toLowerCase().includes(q);
      const matchCons = b.consignment_no.toLowerCase().includes(q);
      const matchCust = b.customer_name.toLowerCase().includes(q);
      const matchPhone = b.customer_phone.includes(q);
      if (!matchInv && !matchCons && !matchCust && !matchPhone) return false;
    }
    return true;
  });

  const handleOpenManualChargeModal = (booking: CourierBooking) => {
    setEditingChargeBooking(booking);
    setManualChargeValue(booking.actual_charge ?? booking.estimated_charge ?? 60);
    setManualChargeNotes(
      booking.actual_charge != null
        ? "Manual adjustment based on Steadfast courier invoice"
        : "Initial confirmed carrier charge entered manually"
    );
    setIsManualChargeModalOpen(true);
  };

  const handleSaveManualCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChargeBooking) return;
    setIsSavingManualCharge(true);
    try {
      const updated = await updateCourierActualChargeManual(
        editingChargeBooking.id,
        Number(manualChargeValue),
        manualChargeNotes
      );
      if (selectedBooking && selectedBooking.id === editingChargeBooking.id) {
        setSelectedBooking(updated);
      }
      setIsManualChargeModalOpen(false);
      setEditingChargeBooking(null);
    } catch (err: any) {
      alert(err.message || "Failed to update courier charge");
    } finally {
      setIsSavingManualCharge(false);
    }
  };

  const handleResolveConflict = async (bookingId: string, resolution: "accept_api" | "keep_manual") => {
    setIsResolvingConflict(true);
    try {
      const updated = await resolveCourierChargeConflict(
        bookingId,
        resolution,
        `Resolved conflict by selecting ${resolution === "accept_api" ? "Steadfast API" : "Manual entry"}`
      );
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking(updated);
      }
    } catch (err: any) {
      alert(err.message || "Failed to resolve conflict");
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleOpenReconcile = (booking: CourierBooking) => {
    setSelectedBooking(booking);
    const effectiveActual = booking.actual_charge ?? booking.estimated_charge ?? 60;
    setReconActualCharge(effectiveActual);
    setReconPayoutAmount(booking.cod_amount - effectiveActual);
    setReconNotes(`COD Payout Settlement for Consignment ${booking.consignment_no}`);
    setIsReconcileModalOpen(true);
  };

  const handleExecuteReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    setIsSubmitting(true);
    try {
      // If actual_charge is pending/null, ensure it is recorded first
      if (selectedBooking.actual_charge == null) {
        await updateCourierActualChargeManual(
          selectedBooking.id,
          Number(reconActualCharge),
          "Confirmed during payout reconciliation settlement"
        );
      }
      await reconcileCourierPayout(
        selectedBooking.id,
        reconPayoutAmount,
        reconAccountId,
        reconNotes
      );
      setIsReconcileModalOpen(false);
      await refreshAll();
    } catch (err: any) {
      alert(err.message || "Reconciliation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (booking: CourierBooking, newStatus: CourierBookingStatus) => {
    try {
      await syncCourierStatus(booking.id, newStatus);
    } catch (err: any) {
      alert(err.message || "Failed to update courier status");
    }
  };

  const handleCalculateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcAddress) return;
    try {
      const res = await calculateCourierCharge(calcAddress, calcWeight);
      setCalcResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBatchSync = async () => {
    setIsSyncingBatch(true);
    try {
      const res = await syncAllCourierBookings();
      alert(`Synchronized with Steadfast API Gateway!
Checked: ${res.total_checked} shipments
Updated: ${res.updated_count} status changes`);
    } catch (err: any) {
      alert(err.message || "Failed to sync with courier API");
    } finally {
      setIsSyncingBatch(false);
    }
  };

  const handleOpenSimulator = () => {
    const firstActive = courierBookings.find((b) => b.status === "in_transit" || b.status === "booked") || courierBookings[0];
    if (firstActive) {
      setSimConsignment(firstActive.consignment_no);
      setSimCod(firstActive.cod_amount);
      setSimActualCharge(firstActive.actual_charge);
    }
    setSimResponse(null);
    setIsSimulatorModalOpen(true);
  };

  const handleTriggerSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simConsignment) return;
    setIsSimulating(true);
    setSimResponse(null);
    try {
      const res = await simulateCourierWebhook({
        consignment_no: simConsignment,
        status: simStatus,
        actual_charge: Number(simActualCharge),
        cod_amount: Number(simCod),
        notes: simNotes,
      });
      setSimResponse(res);
    } catch (err: any) {
      alert(err.message || "Simulation error");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      await updateCourierApiConfig({
        api_key: apiKey,
        secret_key: secretKey,
        base_url: baseUrl,
        webhook_secret: webhookSecret,
        auto_sync_enabled: autoSyncEnabled,
        auto_sync_interval_minutes: Number(autoSyncInterval),
      });
      alert("Steadfast API credentials & webhook settings saved!");
    } catch (err: any) {
      alert(err.message || "Failed to save configuration");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConfig(true);
    setConfigTestResult(null);
    try {
      const res = await testCourierApiConnection();
      setConfigTestResult(res);
    } catch (err: any) {
      setConfigTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingConfig(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLogId(id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  const isSameDay = (b: CourierBooking) => {
    if (b.status !== "delivered" || !b.created_at || !b.updated_at) return false;
    return new Date(b.created_at).toDateString() === new Date(b.updated_at).toDateString();
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto" id="courier-bookings-view">
      <PageHeader
        eyebrow="Courier / Steadfast"
        title="Courier & Dispatch Gateway"
        desc="Real-time shipment tracking, same-day delivery verification, and automated Steadfast COD reconciliation"
        actions={
          <>
            <button
              onClick={handleOpenSimulator}
              className="erp-btn-secondary"
            >
              <Play className="w-3.5 h-3.5" />
              Webhook Simulator
            </button>
            <button
              onClick={handleBatchSync}
              disabled={isSyncingBatch}
              className="erp-btn-secondary"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBatch ? "animate-spin" : ""}`} />
              {isSyncingBatch ? "Syncing..." : "Sync Gateway"}
            </button>
            <button
              onClick={() => setIsCalcModalOpen(true)}
              className="erp-btn-primary"
            >
              <Scale className="w-3.5 h-3.5" />
              Rate Estimator
            </button>
          </>
        }
      />

      {/* Tab Navigation */}
      <div className="flex border-b border-[var(--border)] gap-2">
        <button
          onClick={() => setActiveTab("bookings")}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "bookings"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          <Truck className="w-4 h-4" />
          Shipments &amp; Consignments ({courierBookings.length})
        </button>

        <button
          onClick={() => setActiveTab("batches")}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "batches"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          <Layers className="w-4 h-4" />
          Weekly Settlement Batches
        </button>

        <button
          onClick={() => setActiveTab("webhooks")}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "webhooks"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          <Terminal className="w-4 h-4" />
          Webhook Activity ({courierWebhookLogs.length})
        </button>

        <button
          onClick={() => setActiveTab("config")}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "config"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          <Settings2 className="w-4 h-4" />
          Carrier Gateway API
        </button>
      </div>

      {/* TAB 1: SHIPMENTS & RECONCILIATION */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {/* Dense High-Level Courier KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Active Shipments</div>
              <div className="text-lg font-bold font-num text-[var(--text)]">{activeBookings.length}</div>
              <div className="text-[10px] text-[var(--text-muted)]">{totalBookings} total booked</div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Delivered (Success)</div>
              <div className="text-lg font-bold font-num text-[var(--status-green)]">{deliveredBookings.length}</div>
              <div className="text-[10px] font-semibold text-[var(--status-green)]">{deliverySuccessRate}% success rate</div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Same-Day Delivery</div>
              <div className="text-lg font-bold font-num text-[var(--status-teal)]">{sameDayRate}%</div>
              <div className="text-[10px] text-[var(--text-muted)]">{sameDayDeliveredCount} same-day orders</div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Carrier Fee Status</div>
              <div className="text-lg font-bold font-num text-[var(--text)]">
                {confirmedBookings.length} <span className="text-xs font-normal text-[var(--text-muted)]">/ {totalBookings}</span>
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                {pendingActualCount > 0 ? (
                  <span className="text-amber-700 dark:text-amber-400 font-semibold">{pendingActualCount} pending actual</span>
                ) : (
                  <span className="text-[var(--status-green)] font-semibold">All charges confirmed</span>
                )}
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Courier COD Rec.</div>
              <div className="text-lg font-bold font-num text-[var(--accent)]">&#2547;{courierReceivable.toLocaleString()}</div>
              <div className="text-[10px] text-[var(--text-muted)]">Steadfast clearing</div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Delivery Variance</div>
              <div className={`text-lg font-bold font-num ${netDeliveryVariance >= 0 ? "text-[var(--status-green)]" : "text-[var(--status-red)]"}`}>
                {netDeliveryVariance >= 0 ? "+" : ""}&#2547;{netDeliveryVariance.toLocaleString()}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]" title="Calculated strictly across confirmed actual charges">
                {confirmedBookings.length} confirmed bookings
              </div>
            </div>
          </div>

          {/* Attention Banners: Conflicts or Pending Actual Charges */}
          {(conflictCount > 0 || pendingActualCount > 0) && (
            <div className="flex flex-col sm:flex-row gap-2">
              {conflictCount > 0 && (
                <div className="flex-1 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{conflictCount} Steadfast API Charge Conflict(s) require review.</span>
                  </div>
                  <button
                    onClick={() => setChargeFilter("conflict")}
                    className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                  >
                    View Conflicts
                  </button>
                </div>
              )}
              {pendingActualCount > 0 && (
                <div className="flex-1 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{pendingActualCount} shipment(s) have pending actual charges (estimates not used for accounting).</span>
                  </div>
                  <button
                    onClick={() => setChargeFilter("pending")}
                    className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                  >
                    View Pending
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Consignment, order #, customer..."
                className="erp-input pl-8 w-64"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="erp-select"
            >
              <option value="all">All Courier Statuses</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="rto">RTO / Returned</option>
              <option value="pending">Pending</option>
            </select>

            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="erp-select"
            >
              <option value="all">All Delivery Zones</option>
              <option value="inside_dhaka">Inside Dhaka (&#2547;60)</option>
              <option value="outside_dhaka">Outside Dhaka (&#2547;110)</option>
              <option value="sub_dhaka">Sub-Dhaka (&#2547;100)</option>
            </select>

            <select
              value={payoutFilter}
              onChange={(e) => setPayoutFilter(e.target.value)}
              className="erp-select"
            >
              <option value="all">All Payout States</option>
              <option value="pending">Pending Settlement</option>
              <option value="reconciled">Reconciled</option>
              <option value="discrepancy">Discrepancy</option>
            </select>

            <select
              value={chargeFilter}
              onChange={(e) => setChargeFilter(e.target.value)}
              className="erp-select"
            >
              <option value="all">All Charge States</option>
              <option value="confirmed">Confirmed Actual Charge</option>
              <option value="pending">Pending Actual Charge</option>
              <option value="conflict">API Conflicts</option>
            </select>

            <span className="ml-auto text-[11px] text-[var(--text-muted)] font-num">
              {filteredBookings.length} shipments
            </span>
          </div>

          {/* Bookings Dense Table */}
          <div className="dense-table-container">
            <div className="overflow-x-auto">
              <table className="dense-table">
                <thead>
                  <tr>
                    <th>Order & Consignment</th>
                    <th>Customer & Address</th>
                    <th>Booked / Speed</th>
                    <th>Steadfast Status</th>
                    <th className="text-right">COD Amount</th>
                    <th className="text-center">Cust Fee</th>
                    <th className="text-center">Actual Fee</th>
                    <th className="text-center">Variance</th>
                    <th className="text-center">Payout</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-[var(--text-muted)]">
                        No courier bookings found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((booking) => {
                      const hasActual = booking.actual_charge != null;
                      const isPositive = hasActual && (booking.variance ?? 0) >= 0;
                      const sameDay = isSameDay(booking);
                      return (
                        <tr
                          key={booking.id}
                          className="dense-table-row-clickable"
                          onClick={() => setSelectedBooking(booking)}
                        >
                          <td>
                            <div className="font-bold text-[var(--text)]">{booking.invoice_number}</div>
                            <div className="font-num text-[10px] text-[var(--accent)] font-semibold flex items-center gap-1 mt-0.5">
                              <span>{booking.consignment_no}</span>
                              <span className="text-[9px] px-1 rounded bg-[var(--surface-sunken)] text-[var(--text-muted)]">
                                {booking.package_weight_grams}g
                              </span>
                            </div>
                          </td>

                          <td className="max-w-[200px]">
                            <div className="font-semibold text-[var(--text)] truncate">{booking.customer_name}</div>
                            <div className="font-num text-[10px] text-[var(--text-muted)]">{booking.customer_phone}</div>
                            <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                              {booking.delivery_address}
                            </div>
                          </td>

                          <td>
                            <div className="font-num text-[10px] text-[var(--text-muted)]">
                              {new Date(booking.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </div>
                            {sameDay && (
                              <span className="pill-teal inline-flex items-center rounded-full px-1.5 py-0.2 text-[8px] font-bold border mt-0.5">
                                Same-Day
                              </span>
                            )}
                          </td>

                          <td>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                                booking.status === "delivered"
                                  ? "pill-green"
                                  : booking.status === "rto"
                                  ? "pill-red"
                                  : "pill-teal"
                              }`}
                            >
                              {booking.status.replace("_", " ")}
                            </span>
                          </td>

                          <td className="text-right font-bold font-num text-[var(--text)]">
                            &#2547;{booking.cod_amount.toLocaleString()}
                          </td>

                          <td className="text-center font-num text-[11px]">
                            &#2547;{booking.delivery_charge}
                          </td>

                          <td className="text-center font-num text-[11px]">
                            {hasActual ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-bold text-[var(--text)]">&#2547;{booking.actual_charge}</span>
                                <div className="flex items-center gap-1">
                                  <span
                                    className={`text-[8px] font-bold uppercase px-1 py-0.2 rounded ${
                                      booking.courier_charge_source === "steadfast_api"
                                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                        : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30"
                                    }`}
                                  >
                                    {booking.courier_charge_source === "steadfast_api" ? "API" : "Manual"}
                                  </span>
                                  {booking.pending_api_conflict && (
                                    <span
                                      title={`Conflict! API reported ৳${booking.pending_api_conflict.api_charge}`}
                                      className="text-[8px] font-bold px-1 py-0.2 rounded bg-amber-500 text-white animate-pulse"
                                    >
                                      Conflict
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                                  <Clock className="w-2.5 h-2.5" />
                                  Pending
                                </span>
                                <span
                                  className="text-[9px] text-[var(--text-muted)]"
                                  title="Estimated booking charge — not actual"
                                >
                                  Est: &#2547;{booking.estimated_charge ?? 60}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="text-center font-num font-bold">
                            {hasActual && booking.variance != null ? (
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
                                  isPositive
                                    ? "text-[var(--status-green)] bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)]"
                                    : "text-[var(--status-red)] bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)]"
                                }`}
                              >
                                {isPositive ? "+" : ""}&#2547;{booking.variance}
                              </span>
                            ) : (
                              <span
                                className="text-[10px] text-[var(--text-muted)] italic font-normal"
                                title="Variance is withheld until actual courier charge is confirmed"
                              >
                                Pending
                              </span>
                            )}
                          </td>

                          <td className="text-center">
                            {booking.payout_status === "reconciled" ? (
                              <span className="pill-green inline-flex items-center rounded-full px-1.5 py-0.2 text-[8px] font-bold border">
                                Settled
                              </span>
                            ) : (
                              <span className="pill-amber inline-flex items-center rounded-full px-1.5 py-0.2 text-[8px] font-bold border">
                                Pending
                              </span>
                            )}
                          </td>

                          <td className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {booking.pending_api_conflict ? (
                                <button
                                  onClick={() => setSelectedBooking(booking)}
                                  className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                                >
                                  Resolve
                                </button>
                              ) : !hasActual ? (
                                <button
                                  onClick={() => handleOpenManualChargeModal(booking)}
                                  className="px-1.5 py-0.5 text-[10px] font-semibold rounded border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] text-[var(--text)] transition-colors"
                                  title="Enter actual carrier charge manually"
                                >
                                  Enter Fee
                                </button>
                              ) : null}

                              {booking.payout_status !== "reconciled" && booking.status === "delivered" ? (
                                <button
                                  onClick={() => handleOpenReconcile(booking)}
                                  className="erp-btn-primary text-[10px] px-2 py-0.5"
                                >
                                  Reconcile
                                </button>
                              ) : (
                                <span className="text-[10px] text-[var(--text-muted)] italic font-num">
                                  {booking.payout_status === "reconciled"
                                    ? `\u09F3${booking.payout_amount?.toLocaleString()} cleared`
                                    : "In Transit"}
                                </span>
                              )}
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
        </div>
      )}

      {/* TAB: WEEKLY SETTLEMENT BATCHES */}
      {activeTab === "batches" && (
        <div className="pt-2">
          <CourierSettlementBatchesTab />
        </div>
      )}

      {/* TAB 2: WEBHOOK ACTIVITY & LOGS */}
      {activeTab === "webhooks" && (
        <div className="space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[var(--accent)]" />
                Inbound Webhook Activity Stream
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Listening on <code>POST /api/webhooks/steadfast</code> with HMAC signature validation.
              </p>
            </div>

            <button
              onClick={handleOpenSimulator}
              className="erp-btn-primary"
            >
              <Play className="w-3.5 h-3.5" />
              Simulate Webhook Trigger
            </button>
          </div>

          <div className="dense-table-container">
            <div className="overflow-x-auto">
              <table className="dense-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event Type</th>
                    <th>Consignment / Invoice</th>
                    <th className="text-center">Carrier Status</th>
                    <th className="text-center">Processing</th>
                    <th>Processing Notes</th>
                    <th className="text-center">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {courierWebhookLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                        No webhook activities recorded yet.
                      </td>
                    </tr>
                  ) : (
                    courierWebhookLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="font-num text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                          {new Date(log.received_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &#8226; {new Date(log.received_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </td>

                        <td>
                          <span className="pill-teal inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border font-num">
                            {log.event_type}
                          </span>
                        </td>

                        <td>
                          <div className="font-bold text-[var(--text)] font-num">{log.consignment_no}</div>
                          {log.invoice_number && (
                            <div className="text-[10px] text-[var(--accent)] font-num">{log.invoice_number}</div>
                          )}
                        </td>

                        <td className="text-center font-semibold">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)]">
                            {log.courier_status}
                          </span>
                        </td>

                        <td className="text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                              log.processing_status === "success"
                                ? "pill-green"
                                : log.processing_status === "error"
                                ? "pill-red"
                                : "pill-gray"
                            }`}
                          >
                            {log.processing_status}
                          </span>
                        </td>

                        <td className="max-w-xs text-[var(--text-muted)] text-[11px] truncate" title={log.processing_notes}>
                          {log.processing_notes || "\u2014"}
                        </td>

                        <td className="text-center">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="erp-btn-secondary text-[11px] p-1.5"
                            title="Inspect JSON Payload"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CARRIER CONFIGURATION */}
      {activeTab === "config" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[var(--accent)]" />
                Steadfast Courier API Gateway & Webhook Credentials
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Configure live authentication tokens for automatic consignment sync and webhook verification.
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Gateway Base URL</label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="erp-input w-full font-num"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="erp-input w-full font-num"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Secret Key</label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="erp-input w-full font-num"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Webhook Secret Verification Token</label>
                  <input
                    type="text"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="erp-input w-full font-num"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Auto-Sync Polling Interval (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={autoSyncInterval}
                    onChange={(e) => setAutoSyncInterval(Number(e.target.value))}
                    className="erp-input w-full font-num"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 font-semibold text-[var(--text)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoSyncEnabled}
                      onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                      className="rounded"
                    />
                    Enable Background Auto-Polling
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConfig}
                  className="erp-btn-secondary"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {isTestingConfig ? "Testing..." : "Test Connection Handshake"}
                </button>

                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="erp-btn-primary"
                >
                  {isSavingConfig ? "Saving..." : "Save Carrier Configuration"}
                </button>
              </div>

              {configTestResult && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    configTestResult.success
                      ? "bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border-[color-mix(in_srgb,var(--status-green)_25%,transparent)] text-[var(--status-green)]"
                      : "bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border-[color-mix(in_srgb,var(--status-red)_25%,transparent)] text-[var(--status-red)]"
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {configTestResult.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {configTestResult.message}
                  </div>
                </div>
              )}
            </form>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Steadfast Webhook Specification
            </h4>
            <div className="text-xs text-[var(--text-secondary)] space-y-2 leading-relaxed">
              <p>
                Mirage ERP automatically receives delivery confirmation callbacks from Steadfast via JSON webhooks.
              </p>
              <div className="p-2.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] font-mono text-[10px] space-y-1">
                <div className="font-bold text-[var(--text)]">Supported Status Payloads:</div>
                <div>&#8226; in_transit</div>
                <div>&#8226; delivered</div>
                <div>&#8226; cancelled</div>
                <div>&#8226; return / rto</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Centered Consignment Workspace Modal */}
      {selectedBooking && !isReconcileModalOpen && (
        <Modal
          open={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          size="lg"
          title={`Consignment: ${selectedBooking.consignment_no}`}
          subtitle={`Linked Order ${selectedBooking.invoice_number} \u00B7 ${selectedBooking.customer_name}`}
        >
          <div className="space-y-4 text-xs">
            {/* API Conflict Warning Banner */}
            {selectedBooking.pending_api_conflict && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Steadfast API Charge Conflict Detected</span>
                </div>
                <p className="text-[11px] text-[var(--text)] leading-relaxed">
                  Steadfast API recently reported an actual fee of <strong className="font-num text-[var(--accent)]">&#2547;{selectedBooking.pending_api_conflict.api_charge}</strong> at {new Date(selectedBooking.pending_api_conflict.detected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, but your manual staff entry was set to <strong className="font-num text-[var(--text)]">&#2547;{selectedBooking.pending_api_conflict.manual_charge}</strong>.
                  To protect manual bookkeeping, the ERP preserved your manual charge pending resolution.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleResolveConflict(selectedBooking.id, "accept_api")}
                    disabled={isResolvingConflict}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Accept API Charge (&#2547;{selectedBooking.pending_api_conflict.api_charge})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveConflict(selectedBooking.id, "keep_manual")}
                    disabled={isResolvingConflict}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  >
                    Keep Manual Charge (&#2547;{selectedBooking.pending_api_conflict.manual_charge})
                  </button>
                </div>
              </div>
            )}

            {/* Financial Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl">
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">COD Amount</div>
                <div className="text-base font-bold font-num text-[var(--accent)]">&#2547;{selectedBooking.cod_amount.toLocaleString()}</div>
              </div>

              <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl">
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">Customer Delivery</div>
                <div className="text-base font-bold font-num text-[var(--text)]">&#2547;{selectedBooking.delivery_charge}</div>
                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Est: &#2547;{selectedBooking.estimated_charge ?? 60}</div>
              </div>

              <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Actual Steadfast</span>
                  {selectedBooking.courier_charge_source && (
                    <span
                      className={`text-[8px] font-bold uppercase px-1 py-0.2 rounded ${
                        selectedBooking.courier_charge_source === "steadfast_api"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {selectedBooking.courier_charge_source === "steadfast_api" ? "API" : "Manual"}
                    </span>
                  )}
                </div>
                {selectedBooking.actual_charge != null ? (
                  <div className="text-base font-bold font-num text-[var(--text)]">&#2547;{selectedBooking.actual_charge}</div>
                ) : (
                  <div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                    <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Est: &#2547;{selectedBooking.estimated_charge ?? 60}</div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl">
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">Variance</div>
                {selectedBooking.actual_charge != null && selectedBooking.variance != null ? (
                  <div className={`text-base font-bold font-num ${selectedBooking.variance >= 0 ? "text-[var(--status-green)]" : "text-[var(--status-red)]"}`}>
                    {selectedBooking.variance >= 0 ? "+" : ""}&#2547;{selectedBooking.variance}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--text-muted)] italic font-semibold mt-1">
                    Pending Actual Fee
                  </div>
                )}
                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Cust Fee − Confirmed Actual</div>
              </div>
            </div>

            {/* Manual Fallback Action Box */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] gap-2">
              <div>
                <div className="font-bold text-[var(--text)] flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Courier Cost Control & Manual Fallback</span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {selectedBooking.actual_charge != null
                    ? `Confirmed via ${selectedBooking.courier_charge_source === "steadfast_api" ? "Steadfast API" : "Manual Staff Entry"}. You can override or adjust if the courier invoice statement differs.`
                    : "Steadfast actual charge is still pending. If API is down or delayed, staff can enter confirmed charges manually."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenManualChargeModal(selectedBooking)}
                className="erp-btn-secondary text-xs flex items-center gap-1 shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{selectedBooking.actual_charge != null ? "Adjust Actual Charge" : "Enter Confirmed Charge"}</span>
              </button>
            </div>

            {/* Audit History Log */}
            {selectedBooking.charge_history && selectedBooking.charge_history.length > 0 && (
              <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] space-y-2">
                <div className="font-bold text-[var(--text)] flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Charge Adjustment Audit Trail ({selectedBooking.charge_history.length})</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedBooking.charge_history.map((hist) => (
                    <div
                      key={hist.id}
                      className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <div className="font-semibold text-[var(--text)] flex items-center gap-1.5">
                          <span>
                            {hist.previous_charge != null
                              ? `&#2547;${hist.previous_charge} \u2794 &#2547;${hist.new_charge}`
                              : `Initial Fee: &#2547;${hist.new_charge}`}
                          </span>
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text-muted)] font-bold">
                            {hist.source}
                          </span>
                        </div>
                        {hist.notes && <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{hist.notes}</div>}
                      </div>
                      <div className="text-right text-[10px] text-[var(--text-muted)] font-num">
                        <div>{new Date(hist.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        <div>{hist.actor_name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] space-y-2">
              <div className="font-bold text-[var(--text)]">Delivery Destination & Customer Info</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-[var(--text-muted)]">Recipient:</span> {selectedBooking.customer_name}</div>
                <div><span className="text-[var(--text-muted)]">Phone:</span> <span className="font-num">{selectedBooking.customer_phone}</span></div>
                <div className="col-span-2"><span className="text-[var(--text-muted)]">Address:</span> {selectedBooking.delivery_address}</div>
                <div><span className="text-[var(--text-muted)]">Zone:</span> <span className="capitalize">{selectedBooking.delivery_zone.replace("_", " ")}</span></div>
                <div><span className="text-[var(--text-muted)]">Weight:</span> <span className="font-num">{selectedBooking.package_weight_grams}g</span></div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)]">
              <div>
                <div className="font-bold text-[var(--text)]">Courier Status & Settlement</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Current Status: <span className="font-semibold capitalize">{selectedBooking.status}</span> &#8226; Payout: <span className="capitalize font-semibold">{selectedBooking.payout_status}</span>
                </div>
              </div>
              {selectedBooking.status === "delivered" && selectedBooking.payout_status !== "reconciled" && (
                <button
                  onClick={() => handleOpenReconcile(selectedBooking)}
                  className="erp-btn-primary"
                >
                  Reconcile Payout
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Reconciliation Modal */}
      {isReconcileModalOpen && selectedBooking && (
        <Modal
          open={isReconcileModalOpen}
          onClose={() => setIsReconcileModalOpen(false)}
          size="md"
          title={`Reconcile Courier COD Payout: ${selectedBooking.consignment_no}`}
          subtitle={`Order ${selectedBooking.invoice_number} \u00B7 COD: \u09F3${selectedBooking.cod_amount.toLocaleString()}`}
        >
          <form onSubmit={handleExecuteReconciliation} className="space-y-4 text-xs">
            {/* If actual charge is pending, prompt to confirm it */}
            {selectedBooking.actual_charge == null ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Steadfast Actual Charge is Pending</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Steadfast has not sent a confirmed actual delivery charge yet. Please enter the actual courier charge deducted on your Steadfast settlement statement to ensure accurate accounting:
                </p>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Confirmed Carrier Charge (BDT) *
                  </label>
                  <input
                    type="number"
                    value={reconActualCharge}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setReconActualCharge(val);
                      setReconPayoutAmount(selectedBooking.cod_amount - val);
                    }}
                    className="erp-input w-full font-num font-bold text-sm"
                    required
                    min="0"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Confirmed Carrier Fee</div>
                  <div className="font-bold font-num text-sm text-[var(--text)]">&#2547;{selectedBooking.actual_charge}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Source</div>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)]">
                    {selectedBooking.courier_charge_source === "steadfast_api" ? "Steadfast API" : "Manual Entry"}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Net Payout Received from Steadfast (BDT)
              </label>
              <input
                type="number"
                value={reconPayoutAmount}
                onChange={(e) => setReconPayoutAmount(Number(e.target.value))}
                className="erp-input w-full font-num font-bold text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Deposit Destination Account (Section 15)
              </label>
              <select
                value={reconAccountId}
                onChange={(e) => setReconAccountId(e.target.value)}
                className="erp-select w-full"
              >
                <option value="acc_bank">City Bank Account (acc_bank)</option>
                <option value="acc_cash">Cash in Hand Till (acc_cash)</option>
                <option value="acc_bkash">bKash Merchant Wallet (acc_bkash)</option>
                <option value="acc_nagad">Nagad Merchant Wallet (acc_nagad)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Audit Settlement Notes
              </label>
              <textarea
                rows={2}
                value={reconNotes}
                onChange={(e) => setReconNotes(e.target.value)}
                className="erp-input w-full resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsReconcileModalOpen(false)}
                className="erp-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="erp-btn-primary"
              >
                {isSubmitting ? "Settling..." : "Post Reconciliation Journal"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manual Actual Charge Modal */}
      {isManualChargeModalOpen && editingChargeBooking && (
        <Modal
          open={isManualChargeModalOpen}
          onClose={() => {
            setIsManualChargeModalOpen(false);
            setEditingChargeBooking(null);
          }}
          size="md"
          title={`Record Actual Courier Charge: ${editingChargeBooking.consignment_no}`}
          subtitle={`Order ${editingChargeBooking.invoice_number} \u00B7 Customer Billed Delivery: \u09F3${editingChargeBooking.delivery_charge}`}
        >
          <form onSubmit={handleSaveManualCharge} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)] space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--text-muted)]">Estimated Charge (Booking Estimate):</span>
                <span className="font-num font-semibold text-[var(--text)]">&#2547;{editingChargeBooking.estimated_charge ?? 60}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--text-muted)]">Current Actual Charge:</span>
                <span className="font-num font-semibold text-[var(--text)]">
                  {editingChargeBooking.actual_charge != null ? `\u09F3${editingChargeBooking.actual_charge}` : "Pending Confirmation"}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--text-muted)]">Customer Delivery Charge:</span>
                <span className="font-num font-semibold text-[var(--text)]">&#2547;{editingChargeBooking.delivery_charge}</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Confirmed Actual Carrier Charge (BDT) *
              </label>
              <input
                type="number"
                value={manualChargeValue}
                onChange={(e) => setManualChargeValue(Number(e.target.value))}
                className="erp-input w-full font-num font-bold text-base"
                required
                min="0"
                autoFocus
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                Enter the exact carrier charge confirmed by Steadfast (or courier paper bill). Marked with audit source: <strong>manual</strong>.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Adjustment Reason / Audit Notes
              </label>
              <textarea
                rows={2}
                value={manualChargeNotes}
                onChange={(e) => setManualChargeNotes(e.target.value)}
                placeholder="e.g. Courier invoice statement discrepancy, API unavailable fallback, weight adjustment"
                className="erp-input w-full resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setIsManualChargeModalOpen(false);
                  setEditingChargeBooking(null);
                }}
                className="erp-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingManualCharge}
                className="erp-btn-primary"
              >
                {isSavingManualCharge ? "Saving..." : "Save Actual Charge & Update Accounting"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Webhook Payload Inspection Modal */}
      {selectedLog && (
        <Modal
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          size="lg"
          title={`Webhook Payload: ${selectedLog.consignment_no}`}
          subtitle={`Received ${new Date(selectedLog.received_at).toLocaleString()}`}
        >
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Raw JSON Body</span>
              <button
                onClick={() => handleCopy(JSON.stringify(selectedLog.raw_payload, null, 2), selectedLog.id)}
                className="erp-btn-secondary text-[11px] py-1 px-2.5"
              >
                {copiedLogId === selectedLog.id ? <Check className="w-3 h-3 text-[var(--status-green)]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLogId === selectedLog.id ? "Copied" : "Copy Payload"}</span>
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)] font-num text-[11px] overflow-x-auto max-h-80">
              {JSON.stringify(selectedLog.raw_payload, null, 2)}
            </pre>
          </div>
        </Modal>
      )}

      {/* Simulator Modal */}
      {isSimulatorModalOpen && (
        <Modal
          open={isSimulatorModalOpen}
          onClose={() => setIsSimulatorModalOpen(false)}
          size="md"
          title="Steadfast Inbound Webhook Simulator"
          subtitle="Trigger mock carrier status webhook calls directly into the ERP"
        >
          <form onSubmit={handleTriggerSimulation} className="space-y-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Target Consignment Number
              </label>
              <input
                type="text"
                value={simConsignment}
                onChange={(e) => setSimConsignment(e.target.value)}
                placeholder="SFD..."
                className="erp-input w-full font-num font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Mock Courier Status
                </label>
                <select
                  value={simStatus}
                  onChange={(e) => setSimStatus(e.target.value)}
                  className="erp-select w-full"
                >
                  <option value="delivered">delivered</option>
                  <option value="in_transit">in_transit</option>
                  <option value="rto">rto / returned</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Actual Delivery Fee (BDT)
                </label>
                <input
                  type="number"
                  value={simActualCharge}
                  onChange={(e) => setSimActualCharge(Number(e.target.value))}
                  className="erp-input w-full font-num"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                COD Collected (BDT)
              </label>
              <input
                type="number"
                value={simCod}
                onChange={(e) => setSimCod(Number(e.target.value))}
                className="erp-input w-full font-num"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Courier Rider Notes
              </label>
              <input
                type="text"
                value={simNotes}
                onChange={(e) => setSimNotes(e.target.value)}
                className="erp-input w-full"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsSimulatorModalOpen(false)}
                className="erp-btn-secondary"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSimulating}
                className="erp-btn-primary"
              >
                {isSimulating ? "Sending..." : "Trigger Mock Webhook"}
              </button>
            </div>

            {simResponse && (
              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] font-num text-[11px]">
                <div className="font-bold text-[var(--status-green)] mb-1">&#10003; Webhook Processed Successfully</div>
                <div>Status: {simResponse.status} | Booking ID: {simResponse.booking_id}</div>
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Rate Estimator Modal */}
      {isCalcModalOpen && (
        <Modal
          open={isCalcModalOpen}
          onClose={() => setIsCalcModalOpen(false)}
          size="md"
          title="Steadfast Delivery Zone & Rate Estimator"
          subtitle="Compute estimated courier freight based on address parsing & weight"
        >
          <form onSubmit={handleCalculateRate} className="space-y-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Customer Destination Address
              </label>
              <textarea
                rows={2}
                value={calcAddress}
                onChange={(e) => setCalcAddress(e.target.value)}
                placeholder="e.g. Banani, Dhaka or Agrabad, Chittagong..."
                className="erp-input w-full resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Estimated Parcel Weight (Grams)
              </label>
              <input
                type="number"
                value={calcWeight}
                onChange={(e) => setCalcWeight(Number(e.target.value))}
                className="erp-input w-full font-num"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsCalcModalOpen(false)}
                className="erp-btn-secondary"
              >
                Close
              </button>
              <button
                type="submit"
                className="erp-btn-primary"
              >
                Calculate Rate
              </button>
            </div>

            {calcResult && (
              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] space-y-1">
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Calculation Result</div>
                <div className="text-base font-bold text-[var(--accent)] font-num">&#2547;{calcResult.actualFee} Estimated Freight</div>
                <div className="text-[11px] text-[var(--text-secondary)]">Zone: <span className="font-semibold capitalize">{calcResult.zone.replace("_", " ")}</span></div>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
};
