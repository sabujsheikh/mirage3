import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Product,
  Order,
  Customer,
  StockMovement,
  Account,
  JournalEntry,
  AuditLogEntry,
  CompanySettings,
  NotificationItem,
  CourierBooking,
  ReconciliationSummary,
  CourierBookingStatus,
  Supplier,
  SupplierPayment,
  PurchaseOrder,
  PurchaseReturn,
  CourierWebhookLog,
  CourierApiConfig,
  CustomerReturn,
  DailyCashRegisterLog,
  ExpenseRecord,
  Employee,
  PayrollRecord,
  ProfitLossReport,
  BalanceSheetReport,
  ApprovalRequest,
  CompetitorPriceRecord,
  PricingRule,
  PricingCampaign,
  RepricingSuggestion,
  SecuritySettings,
  BackupSnapshot,
  SystemHealthStatus,
  User,
  Warehouse,
  PackagingMaterial,
  PackagingStockMovement,
  ProductBatch,
  DamagedStockRecord,
  CashierDailyClosing,
  PaymentAccount,
  FundTransferRecord,
  ManualAdjustmentRecord,
  PaymentAccountsReportData,
  DailyBusinessControlReportData,
  FinancialCrossCheckReport,
} from '../types';
import { useAuth } from './AuthContext';
import { sound } from '../lib/audio';

export interface AppContextType {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  paymentAccounts: PaymentAccount[];
  fundTransfers: FundTransferRecord[];
  manualAdjustments: ManualAdjustmentRecord[];
  fetchPaymentAccounts: () => Promise<void>;
  fetchPaymentAccountStatement: (id: string, startDate?: string, endDate?: string) => Promise<any>;
  createPaymentAccount: (data: any) => Promise<PaymentAccount>;
  updatePaymentAccount: (id: string, data: any) => Promise<PaymentAccount>;
  togglePaymentAccountActive: (id: string, isActive: boolean) => Promise<PaymentAccount>;
  transferFunds: (data: any) => Promise<any>;
  depositFunds: (data: any) => Promise<any>;
  withdrawFunds: (data: any) => Promise<any>;
  fetchFundTransfers: () => Promise<void>;
  fetchManualAdjustments: (paymentAccountId?: string) => Promise<void>;
  createManualAdjustment: (data: any) => Promise<any>;
  voidManualAdjustment: (id: string, reason: string) => Promise<any>;
  courierBookings: CourierBooking[];
  reconciliationSummary: ReconciliationSummary | null;
  courierWebhookLogs: CourierWebhookLog[];
  courierApiConfig: CourierApiConfig | null;
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  purchaseReturns: PurchaseReturn[];
  customerReturns: CustomerReturn[];
  returnsSummary: any | null;
  cashRegisterLogs: DailyCashRegisterLog[];
  expenses: ExpenseRecord[];
  employees: Employee[];
  payrollRecords: PayrollRecord[];
  approvalRequests: ApprovalRequest[];
  approvalSummary: any | null;
  competitorPrices: CompetitorPriceRecord[];
  pricingRules: PricingRule[];
  pricingCampaigns: PricingCampaign[];
  repricingSuggestions: RepricingSuggestion[];
  backups: BackupSnapshot[];
  securitySettings: SecuritySettings | null;
  systemHealth: SystemHealthStatus | null;
  pnlReport: ProfitLossReport | null;
  balanceSheetReport: BalanceSheetReport | null;
  stockMovements: StockMovement[];
  batches: ProductBatch[];
  damagedStock: DamagedStockRecord[];
  accounts: Account[];
  journalEntries: JournalEntry[];
  auditLogs: AuditLogEntry[];
  settings: CompanySettings | null;
  notifications: NotificationItem[];
  users: User[];
  warehouses: Warehouse[];
  packagingMaterials: PackagingMaterial[];
  packagingMovements: PackagingStockMovement[];
  cashierClosings: CashierDailyClosing[];
  activeCashierClosing: CashierDailyClosing | null;
  unclosedCashierDays: CashierDailyClosing[];
  isLoading: boolean;
  isInitialized: boolean;
  activePath: string;
  setActivePath: (path: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebar: () => void;
  createOrder: (data: any) => Promise<Order>;
  editOrder: (orderId: string, data: any) => Promise<Order>;
  movePreOrderToToday: (orderId: string) => Promise<Order>;
  bulkMovePreOrdersToToday: (orderIds: string[]) => Promise<{ moved_count: number; failed_count: number; errors: string[] }>;
  parseMessenger: (rawText: string) => Promise<any>;
  receiveStock: (data: any) => Promise<any>;
  setOpeningStock: (data: any) => Promise<void>;
  setOpeningBalance: (data: any) => Promise<void>;
  transferStock: (data: any) => Promise<any>;
  packOrder: (orderId: string, options?: { package_weight_grams?: number; box_size?: string; qa_notes?: string }) => Promise<Order>;
  // Packing \u2192 Steadfast booking \u2192 thermal label \u2192 verify \u2192 dispatch workflow
  bookCourier: (orderId: string, trackingCode?: string, actualCharge?: number) => Promise<Order>;
  recordLabelPrinted: (orderId: string) => Promise<Order>;
  verifyTrackingBarcode: (orderId: string, scannedBarcode: string) => Promise<Order>;
  dispatchOrder: (orderId: string) => Promise<Order>;
  cancelOrder: (orderId: string, reason: string) => Promise<Order>;
  syncCourierStatus: (bookingId: string, newStatus: CourierBookingStatus, actualChargeOverride?: number, notes?: string) => Promise<CourierBooking>;
  reconcileCourierPayout: (bookingId: string, actualPayout?: number, paymentAccountId?: string, notes?: string) => Promise<CourierBooking>;
  updateCourierActualChargeManual: (bookingId: string, actualCharge: number, notes?: string) => Promise<CourierBooking>;
  resolveCourierChargeConflict: (bookingId: string, resolution: 'accept_api' | 'keep_manual', notes?: string) => Promise<CourierBooking>;
  updateReturnCourierFeeManual: (returnId: string, feeLoss: number, notes?: string) => Promise<CustomerReturn>;
  calculateCourierCharge: (address: string, weightGrams?: number) => Promise<{ zone: string; actualFee: number }>;
  syncAllCourierBookings: () => Promise<any>;
  simulateCourierWebhook: (data: any) => Promise<any>;
  updateCourierApiConfig: (data: any) => Promise<any>;
  testCourierApiConnection: () => Promise<any>;
  processCustomerReturn: (data: any) => Promise<CustomerReturn>;
  reconcileDailyCashRegister: (data: any) => Promise<DailyCashRegisterLog>;
  fetchCashierClosings: (filters?: any) => Promise<void>;
  fetchActiveCashierClosing: (cashierId?: string) => Promise<CashierDailyClosing | null>;
  startCashierBusinessDay: (data: { opening_float?: number; business_date?: string; cashier_id?: string; cashier_name?: string }) => Promise<CashierDailyClosing>;
  addCashierCashExpense: (closingId: string, expenseData: { category?: string; description: string; amount: number; receipt_reference?: string }) => Promise<CashierDailyClosing>;
  submitCashierDailyClosing: (closingId: string, data: { actual_cash: number; denominations?: any; closing_notes?: string }) => Promise<CashierDailyClosing>;
  reviewCashierDailyClosing: (closingId: string, data: { action: 'approve' | 'reject'; review_notes?: string }) => Promise<CashierDailyClosing>;
  recordExpense: (data: any) => Promise<ExpenseRecord>;
  voidExpense: (id: string, reason: string) => Promise<ExpenseRecord>;
  createEmployee: (data: any) => Promise<Employee>;
  updateEmployee: (id: string, data: any) => Promise<Employee>;
  processPayroll: (data: any) => Promise<PayrollRecord>;
  createApprovalRequest: (data: any) => Promise<ApprovalRequest>;
  reviewApprovalRequest: (id: string, decision: 'approved' | 'rejected', notes?: string) => Promise<ApprovalRequest>;
  recordCompetitorPrice: (data: any) => Promise<CompetitorPriceRecord>;
  deleteCompetitorPrice: (id: string) => Promise<void>;
  savePricingRule: (data: any) => Promise<PricingRule>;
  createPricingCampaign: (data: any) => Promise<PricingCampaign>;
  togglePricingCampaign: (id: string, active: boolean) => Promise<PricingCampaign>;
  applyRepricing: (productId: string, newPrice: number, reason: string) => Promise<Product>;
  generate2FASetup: (userId: string) => Promise<{ secret: string; qr_code_uri: string; backup_codes: string[] }>;
  verifyAndEnable2FA: (data: any) => Promise<User>;
  disable2FA: (userId: string) => Promise<User>;
  createBackup: () => Promise<BackupSnapshot>;
  downloadBackup: (id: string) => void;
  restoreBackup: (snapshotData: any) => Promise<any>;
  updateSecuritySettings: (data: Partial<SecuritySettings>) => Promise<SecuritySettings>;
  fetchSystemHealth: () => Promise<SystemHealthStatus>;
  fetchPnlReport: (startDate?: string, endDate?: string) => Promise<ProfitLossReport>;
  fetchBalanceSheetReport: (asOfDate?: string) => Promise<BalanceSheetReport>;
  fetchPaymentAccountsReport: (filters?: any) => Promise<PaymentAccountsReportData>;
  fetchDailyBusinessControlReport: (filters?: any) => Promise<DailyBusinessControlReportData>;
  fetchFinancialCrossCheck: () => Promise<FinancialCrossCheckReport>;
  postMovement: (data: any) => Promise<any>;
  postJournalEntry: (data: any) => Promise<any>;
  createProduct: (data: any) => Promise<Product>;
  updateProduct: (id: string, data: any) => Promise<Product>;
  deleteProduct: (id: string, reason: string) => Promise<void>;
  importBulkCsv: (rows: any[]) => Promise<number>;
  createSupplier: (data: any) => Promise<Supplier>;
  updateSupplier: (id: string, data: any) => Promise<Supplier>;
  recordSupplierPayment: (supplierId: string, data: any) => Promise<SupplierPayment>;
  fetchSupplierStatement: (supplierId: string) => Promise<any>;
  createPurchaseOrder: (data: any) => Promise<PurchaseOrder>;
  updatePurchaseOrderStatus: (id: string, status: string) => Promise<PurchaseOrder>;
  receivePurchaseOrderItems: (id: string, data: any) => Promise<PurchaseOrder>;
  createPurchaseReturn: (data: any) => Promise<PurchaseReturn>;
  updateSettings: (data: Partial<CompanySettings>) => Promise<void>;
  createPackagingMaterial: (data: any) => Promise<PackagingMaterial>;
  updatePackagingMaterial: (id: string, data: any, actor_id?: string, actor_name?: string) => Promise<void>;
  receivePackagingStock: (material_id: string, quantity: number, unit_cost: number, reference_note?: string, actor_id?: string, actor_name?: string) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  refreshAll: () => Promise<void>;
  recordOrderPayment: (orderId: string, data: {
    amount: number;
    method: 'cash' | 'bkash' | 'nagad' | 'bank' | 'card';
    payment_account_id: string;
    transaction_ref?: string;
    notes?: string;
  }) => Promise<Order>;
  deleteOrder: (orderId: string) => Promise<void>;
  bulkDeleteOrders: (orderIds: string[]) => Promise<void>;
}




const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, users, sessionToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [courierBookings, setCourierBookings] = useState<CourierBooking[]>([]);
  const [reconciliationSummary, setReconciliationSummary] = useState<ReconciliationSummary | null>(null);
  const [courierWebhookLogs, setCourierWebhookLogs] = useState<CourierWebhookLog[]>([]);
  const [courierApiConfig, setCourierApiConfig] = useState<CourierApiConfig | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [customerReturns, setCustomerReturns] = useState<CustomerReturn[]>([]);
  const [returnsSummary, setReturnsSummary] = useState<any | null>(null);
  const [cashRegisterLogs, setCashRegisterLogs] = useState<DailyCashRegisterLog[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [approvalSummary, setApprovalSummary] = useState<any | null>(null);
  const [competitorPrices, setCompetitorPrices] = useState<CompetitorPriceRecord[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [pricingCampaigns, setPricingCampaigns] = useState<PricingCampaign[]>([]);
  const [repricingSuggestions, setRepricingSuggestions] = useState<RepricingSuggestion[]>([]);
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthStatus | null>(null);
  const [pnlReport, setPnlReport] = useState<ProfitLossReport | null>(null);
  const [balanceSheetReport, setBalanceSheetReport] = useState<BalanceSheetReport | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [damagedStock, setDamagedStock] = useState<DamagedStockRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [fundTransfers, setFundTransfers] = useState<FundTransferRecord[]>([]);
  const [manualAdjustments, setManualAdjustments] = useState<ManualAdjustmentRecord[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [packagingMaterials, setPackagingMaterials] = useState<PackagingMaterial[]>([]);
  const [packagingMovements, setPackagingMovements] = useState<PackagingStockMovement[]>([]);
  const [cashierClosings, setCashierClosings] = useState<CashierDailyClosing[]>([]);
  const [activeCashierClosing, setActiveCashierClosing] = useState<CashierDailyClosing | null>(null);
  const [unclosedCashierDays, setUnclosedCashierDays] = useState<CashierDailyClosing[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [activePath, setActivePath] = useState<string>('/dashboard');
  const [sidebarOpen, setSidebarOpenState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mirage_sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const setSidebarOpen = useCallback((action: boolean | ((prev: boolean) => boolean)) => {
    setSidebarOpenState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      try {
        localStorage.setItem('mirage_sidebar_open', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpenState(prev => {
      const next = !prev;
      try {
        localStorage.setItem('mirage_sidebar_open', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('mirage_session_token') : null);
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-session-token'] = token;
    }
    if (currentUser?.id) {
      headers['x-authenticated-user-id'] = currentUser.id;
    }
    return headers;
  }, [sessionToken, currentUser]);

  const authFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const authHeaders = getAuthHeaders();
    const mergedHeaders = {
      ...authHeaders,
      ...(init?.headers || {}),
    };
    return fetch(input, { ...init, headers: mergedHeaders });
  }, [getAuthHeaders]);

  const fetchAllData = useCallback(async () => {
    try {
      const authH = getAuthHeaders();
      const safeFetch = (url: string) =>
        fetch(url, { headers: authH })
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null);

      const [
        prodsRes,
        ordersRes,
        custsRes,
        bookingsRes,
        reconRes,
        webhookLogsRes,
        courierConfigRes,
        suppsRes,
        posRes,
        returnsRes,
        custReturnsRes,
        returnsSumRes,
        cashRegRes,
        expRes,
        empRes,
        payrollRes,
        approvalsRes,
        rulesRes,
        competitorsRes,
        campaignsRes,
        suggestionsRes,
        backupsRes,
        secSettingsRes,
        healthRes,
        pnlRes,
        bsRes,
        movsRes,
        accsRes,
        jeRes,
        audRes,
        setRes,
        notifRes,
        whRes,
        pkgMatsRes,
        pkgMovRes,
        batchesRes,
        damagedRes,
        closingsRes,
        activeClosingRes,
        pmtAccsRes,
        transfersRes,
        manAdjRes,
      ] = await Promise.all([
        safeFetch('/api/products'),
        safeFetch('/api/orders'),
        safeFetch('/api/customers'),
        safeFetch('/api/courier/bookings'),
        safeFetch('/api/accounting/reconciliation'),
        safeFetch('/api/courier/webhooks/logs'),
        safeFetch('/api/courier/config'),
        safeFetch('/api/suppliers'),
        safeFetch('/api/purchasing/orders'),
        safeFetch('/api/purchasing/returns'),
        safeFetch('/api/returns'),
        safeFetch('/api/returns/summary'),
        safeFetch('/api/accounting/cash-register'),
        safeFetch('/api/accounting/expenses'),
        safeFetch('/api/employees'),
        safeFetch('/api/accounting/payroll'),
        safeFetch('/api/approvals'),
        safeFetch('/api/pricing/rules'),
        safeFetch('/api/pricing/competitors'),
        safeFetch('/api/pricing/campaigns'),
        safeFetch('/api/pricing/suggestions'),
        safeFetch('/api/backups'),
        safeFetch('/api/security/settings'),
        safeFetch('/api/system/health'),
        safeFetch('/api/accounting/reports/pnl'),
        safeFetch('/api/accounting/reports/balance-sheet'),
        safeFetch('/api/inventory/ledger'),
        safeFetch('/api/accounting/accounts'),
        safeFetch('/api/accounting/journal'),
        safeFetch('/api/audit-log'),
        safeFetch('/api/settings'),
        safeFetch('/api/notifications'),
        safeFetch('/api/warehouses'),
        safeFetch('/api/packaging/materials'),
        safeFetch('/api/packaging/movements'),
        safeFetch('/api/inventory/batches'),
        safeFetch('/api/inventory/damaged-stock'),
        safeFetch('/api/cashier-closings'),
        safeFetch('/api/cashier-closings/active'),
        safeFetch('/api/accounting/payment-accounts'),
        safeFetch('/api/accounting/transfers'),
        safeFetch('/api/accounting/manual-adjustments'),
      ]);

      setProducts(Array.isArray(prodsRes) ? prodsRes : []);
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);
      setCustomers(Array.isArray(custsRes) ? custsRes : []);
      setCourierBookings(Array.isArray(bookingsRes) ? bookingsRes : []);
      if (reconRes && typeof reconRes === 'object' && reconRes.summary) {
        setReconciliationSummary(reconRes.summary);
      }
      setCourierWebhookLogs(Array.isArray(webhookLogsRes) ? webhookLogsRes : []);
      setCourierApiConfig(courierConfigRes && !courierConfigRes.error ? courierConfigRes : null);
      setSuppliers(Array.isArray(suppsRes) ? suppsRes : []);
      setPurchaseOrders(Array.isArray(posRes) ? posRes : []);
      setPurchaseReturns(Array.isArray(returnsRes) ? returnsRes : []);
      setCustomerReturns(Array.isArray(custReturnsRes) ? custReturnsRes : []);
      setReturnsSummary(returnsSumRes && !returnsSumRes.error ? returnsSumRes : null);
      setCashRegisterLogs(Array.isArray(cashRegRes) ? cashRegRes : []);
      setExpenses(Array.isArray(expRes) ? expRes : []);
      setEmployees(Array.isArray(empRes) ? empRes : []);
      setPayrollRecords(Array.isArray(payrollRes) ? payrollRes : []);
      if (approvalsRes && typeof approvalsRes === 'object' && !approvalsRes.error) {
        setApprovalRequests(Array.isArray(approvalsRes.requests) ? approvalsRes.requests : []);
        setApprovalSummary(approvalsRes.summary || null);
      }
      setPricingRules(Array.isArray(rulesRes) ? rulesRes : []);
      setCompetitorPrices(Array.isArray(competitorsRes) ? competitorsRes : []);
      setPricingCampaigns(Array.isArray(campaignsRes) ? campaignsRes : []);
      setRepricingSuggestions(Array.isArray(suggestionsRes) ? suggestionsRes : []);
      setBackups(Array.isArray(backupsRes) ? backupsRes : []);
      setSecuritySettings(secSettingsRes && !secSettingsRes.error ? secSettingsRes : null);
      setSystemHealth(healthRes && !healthRes.error ? healthRes : null);
      setPnlReport(pnlRes && !pnlRes.error ? pnlRes : null);
      setBalanceSheetReport(bsRes && !bsRes.error ? bsRes : null);
      setStockMovements(Array.isArray(movsRes) ? movsRes : []);
      setAccounts(Array.isArray(accsRes) ? accsRes : []);
      setJournalEntries(Array.isArray(jeRes) ? jeRes : []);
      setAuditLogs(Array.isArray(audRes) ? audRes : []);
      setSettings(setRes && !setRes.error ? setRes : null);
      setNotifications(Array.isArray(notifRes) ? notifRes : []);
      setWarehouses(Array.isArray(whRes) ? whRes : []);
      setPackagingMaterials(Array.isArray(pkgMatsRes) ? pkgMatsRes : []);
      setPackagingMovements(Array.isArray(pkgMovRes) ? pkgMovRes : []);
      setBatches(Array.isArray(batchesRes) ? batchesRes : []);
      setDamagedStock(Array.isArray(damagedRes) ? damagedRes : []);
      setCashierClosings(Array.isArray(closingsRes) ? closingsRes : []);
      if (activeClosingRes && typeof activeClosingRes === 'object') {
        setActiveCashierClosing(activeClosingRes.active || null);
        setUnclosedCashierDays(Array.isArray(activeClosingRes.unclosedDays) ? activeClosingRes.unclosedDays : []);
      }
      setPaymentAccounts(Array.isArray(pmtAccsRes) ? pmtAccsRes : []);
      setFundTransfers(Array.isArray(transfersRes) ? transfersRes : []);
      setManualAdjustments(Array.isArray(manAdjRes) ? manAdjRes : []);
    } catch (err) {
      console.error('Failed to fetch app data:', err);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [getAuthHeaders]);




  useEffect(() => {
    fetchAllData();
  }, [fetchAllData, sessionToken, currentUser?.id]);

  useEffect(() => {

    // SSE connection for immediate real-time packing & new order broadcasts
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'order_created') {
            sound.playNewOrderAlert();
            fetchAllData();
          } else if (parsed.type === 'order_packed' || parsed.type === 'order_dispatched' || parsed.type === 'price_updated') {
            // price_updated: refresh so the notification bell badge + product
            // highlight appear promptly (Point 3.2) \u2014 no sound for price changes.
            fetchAllData();
          }
        } catch (e) {
          // ignore parse errors
        }
      };
    } catch (e) {
      console.warn('SSE connection not available, falling back to polling');
    }

    // Polling interval fallback (Section 4: 10-15 seconds)
    const interval = setInterval(() => {
      fetchAllData();
    }, 12000);

    const handleFocus = () => fetchAllData();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchAllData]);

  const parseMessenger = async (rawText: string) => {
    const res = await fetch('/api/orders/parse-messenger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: rawText }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to parse text');
    }
    return res.json();
  };

  const createOrder = async (data: any): Promise<Order> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create order');
    }
    const created: Order = await res.json();
    await fetchAllData();
    return created;
  };

  const editOrder = async (orderId: string, data: any): Promise<Order> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to edit order');
    }
    const updated: Order = await res.json();
    await fetchAllData();
    return updated;
  };

  const movePreOrderToToday = async (orderId: string): Promise<Order> => {
    const res = await fetch(`/api/orders/${orderId}/move-to-today`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to move order to Today');
    }
    const updated: Order = await res.json();
    await fetchAllData();
    return updated;
  };

  const bulkMovePreOrdersToToday = async (orderIds: string[]): Promise<{ moved_count: number; failed_count: number; errors: string[] }> => {
    const res = await fetch('/api/orders/bulk-move-to-today', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
      body: JSON.stringify({ order_ids: orderIds }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to move pre-orders to Today');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const cancelOrder = async (orderId: string, reason: string): Promise<Order> => {
    const res = await fetch(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to cancel order');
    }
    const updated: Order = await res.json();
    await fetchAllData();
    return updated;
  };

  const receiveStock = async (data: any) => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/inventory/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to receive stock');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const setOpeningStock = async (data: any) => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/inventory/opening-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to set opening stock');
    }
    await fetchAllData();
  };

  const setOpeningBalance = async (data: any) => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/accounting/opening-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to set opening balance');
    }
    await fetchAllData();
  };

  const transferStock = async (data: any) => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/inventory/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to transfer stock');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const packOrder = async (
    orderId: string,
    options?: { package_weight_grams?: number; box_size?: string; qa_notes?: string }
  ): Promise<Order> => {
    const payload = {
      ...options,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/orders/${orderId}/pack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to pack order');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const bookCourier = async (orderId: string, trackingCode?: string, actualCharge?: number): Promise<Order> => {
    const payload = {
      tracking_code: trackingCode,
      actual_charge: actualCharge,
      force_steadfast: true,
      actor_id: currentUser?.id || 'usr_owner',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/orders/${orderId}/book-courier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        'x-authenticated-user-id': currentUser?.id || 'usr_owner',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to book order with Steadfast');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const recordOrderPayment = async (
    orderId: string,
    data: {
      amount: number;
      method: 'cash' | 'bkash' | 'nagad' | 'bank' | 'card';
      payment_account_id: string;
      transaction_ref?: string;
      notes?: string;
    }
  ): Promise<Order> => {
    const res = await fetch(`/api/orders/${orderId}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authenticated-user-id': currentUser?.id || '',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record payment');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const recordLabelPrinted = async (orderId: string): Promise<Order> => {
    const payload = {
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/orders/${orderId}/label-printed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record label print');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const verifyTrackingBarcode = async (orderId: string, scannedBarcode: string): Promise<Order> => {
    const payload = {
      scanned_barcode: scannedBarcode,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/orders/${orderId}/verify-tracking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to verify tracking barcode');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const dispatchOrder = async (orderId: string): Promise<Order> => {
    const payload = {
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/orders/${orderId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authenticated-user-id': currentUser?.id || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to dispatch order');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const calculateCourierCharge = async (address: string, weightGrams?: number): Promise<{ zone: string; actualFee: number }> => {
    const res = await fetch('/api/courier/calculate-charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, weight_grams: weightGrams }),
    });
    if (!res.ok) {
      return { zone: 'inside_dhaka', actualFee: 60 };
    }
    return res.json();
  };

  const syncCourierStatus = async (
    bookingId: string,
    newStatus: CourierBookingStatus,
    actualChargeOverride?: number,
    notes?: string
  ): Promise<CourierBooking> => {
    const payload = {
      booking_id: bookingId,
      new_status: newStatus,
      actual_charge_override: actualChargeOverride,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
      notes,
    };
    const res = await fetch('/api/courier/sync-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update courier status');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const reconcileCourierPayout = async (
    bookingId: string,
    actualPayout?: number,
    paymentAccountId?: string,
    notes?: string
  ): Promise<CourierBooking> => {
    const payload = {
      booking_id: bookingId,
      actual_payout: actualPayout,
      payment_account_id: paymentAccountId,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
      notes,
    };
    const res = await fetch('/api/courier/reconcile-payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reconcile payout');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const updateCourierActualChargeManual = async (
    bookingId: string,
    actualCharge: number,
    notes?: string
  ): Promise<CourierBooking> => {
    const payload = {
      actual_charge: actualCharge,
      notes,
    };
    const res = await fetch(`/api/courier/bookings/${bookingId}/update-actual-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update courier charge');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const resolveCourierChargeConflict = async (
    bookingId: string,
    resolution: 'accept_api' | 'keep_manual',
    notes?: string
  ): Promise<CourierBooking> => {
    const payload = {
      resolution,
      notes,
    };
    const res = await fetch(`/api/courier/bookings/${bookingId}/resolve-conflict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to resolve courier charge conflict');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const updateReturnCourierFeeManual = async (
    returnId: string,
    feeLoss: number,
    notes?: string
  ): Promise<CustomerReturn> => {
    const payload = {
      courier_fee_loss: feeLoss,
      notes,
    };
    const res = await fetch(`/api/returns/${returnId}/update-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update return courier fee');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const postMovement = async (data: any) => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/inventory/adjustment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to post stock movement');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const postJournalEntry = async (data: any) => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/accounting/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to post journal entry');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const createProduct = async (data: any): Promise<Product> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create product');
    }
    const prod: Product = await res.json();
    await fetchAllData();
    return prod;
  };

  const updateProduct = async (id: string, data: any): Promise<Product> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update product');
    }
    const prod: Product = await res.json();
    await fetchAllData();
    return prod;
  };

  const importBulkCsv = async (rows: any[]): Promise<number> => {
    const payload = {
      rows,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/products/bulk-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to import CSV');
    }
    const data = await res.json();
    await fetchAllData();
    return data.count || 0;
  };

  const deleteProduct = async (id: string, reason: string): Promise<void> => {
    const res = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirm_step: 3,
        reason,
        actor_id: currentUser?.id || 'system',
        actor_name: currentUser?.name || 'Staff',
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete product');
    }
    await fetchAllData();
  };

  const updateSettings = async (data: Partial<CompanySettings>) => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update settings');
    }
    const updated = await res.json();
    setSettings(updated);
  };

  // Packaging Materials CRUD
  const createPackagingMaterial = async (data: any): Promise<PackagingMaterial> => {
    const payload = { ...data, actor_id: currentUser?.id || 'system', actor_name: currentUser?.name || 'Staff' };
    const res = await fetch('/api/packaging/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to create packaging material'); }
    const mat = await res.json();
    setPackagingMaterials(prev => [...prev, mat]);
    return mat;
  };

  const updatePackagingMaterial = async (id: string, data: any, actor_id?: string, actor_name?: string): Promise<void> => {
    const payload = { ...data, actor_id: actor_id || currentUser?.id || 'system', actor_name: actor_name || currentUser?.name || 'Staff' };
    const res = await fetch(`/api/packaging/materials/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update'); }
    const updated = await res.json();
    setPackagingMaterials(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m));
  };

  const receivePackagingStock = async (material_id: string, quantity: number, unit_cost: number, reference_note?: string, actor_id?: string, actor_name?: string): Promise<void> => {
    const payload = { material_id, quantity, unit_cost, reference_note, actor_id: actor_id || currentUser?.id || 'system', actor_name: actor_name || currentUser?.name || 'Staff' };
    const res = await fetch('/api/packaging/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to receive stock'); }
    const updated = await res.json();
    setPackagingMaterials(prev => prev.map(m => m.id === material_id ? { ...m, ...updated } : m));
    // Refresh movements
    const movRes = await fetch('/api/packaging/movements').then(r => r.json());
    setPackagingMovements(movRes || []);
  };

  const createSupplier = async (data: any): Promise<Supplier> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create supplier');
    }
    const supp = await res.json();
    await fetchAllData();
    return supp;
  };

  const updateSupplier = async (id: string, data: any): Promise<Supplier> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update supplier');
    }
    const supp = await res.json();
    await fetchAllData();
    return supp;
  };

  const recordSupplierPayment = async (supplierId: string, data: any): Promise<SupplierPayment> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/suppliers/${supplierId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record supplier payment');
    }
    const payment = await res.json();
    await fetchAllData();
    return payment;
  };

  const fetchSupplierStatement = async (supplierId: string): Promise<any> => {
    const res = await fetch(`/api/suppliers/${supplierId}/statement`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch supplier statement');
    }
    return res.json();
  };

  const createPurchaseOrder = async (data: any): Promise<PurchaseOrder> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/purchasing/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create purchase order');
    }
    const po = await res.json();
    await fetchAllData();
    return po;
  };

  const updatePurchaseOrderStatus = async (id: string, status: string): Promise<PurchaseOrder> => {
    const payload = {
      status,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/purchasing/orders/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update PO status');
    }
    const po = await res.json();
    await fetchAllData();
    return po;
  };

  const receivePurchaseOrderItems = async (id: string, data: any): Promise<PurchaseOrder> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/purchasing/orders/${id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to receive PO items');
    }
    const po = await res.json();
    await fetchAllData();
    return po;
  };

  const createPurchaseReturn = async (data: any): Promise<PurchaseReturn> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/purchasing/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create purchase return');
    }
    const pr = await res.json();
    await fetchAllData();
    return pr;
  };

  const syncAllCourierBookings = async (): Promise<any> => {
    const payload = {
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/courier/sync-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to sync with Steadfast API');
    }
    const data = await res.json();
    await fetchAllData();
    return data;
  };

  const simulateCourierWebhook = async (data: any): Promise<any> => {
    const res = await fetch('/api/courier/webhooks/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to simulate webhook');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const updateCourierApiConfig = async (data: any): Promise<any> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/courier/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update courier API config');
    }
    const config = await res.json();
    await fetchAllData();
    return config;
  };

  const testCourierApiConnection = async (): Promise<any> => {
    const res = await fetch('/api/courier/config/test', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Courier API connection test failed');
    }
    return data;
  };

  const processCustomerReturn = async (data: any): Promise<CustomerReturn> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to process return');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const reconcileDailyCashRegister = async (data: any): Promise<DailyCashRegisterLog> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/accounting/cash-register/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reconcile cash register');
    }
    const log = await res.json();
    await fetchAllData();
    return log;
  };

  const fetchCashierClosings = async (filters?: any) => {
    try {
      const q = new URLSearchParams(filters || {}).toString();
      const res = await authFetch(`/api/cashier-closings${q ? '?' + q : ''}`);
      if (res.ok) {
        const data = await res.json();
        setCashierClosings(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch cashier closings:', e);
    }
  };

  const fetchActiveCashierClosing = async (cashierId?: string): Promise<CashierDailyClosing | null> => {
    try {
      const cid = cashierId || currentUser?.id;
      const res = await authFetch(`/api/cashier-closings/active${cid ? '?cashier_id=' + cid : ''}`);
      if (res.ok) {
        const data = await res.json();
        setActiveCashierClosing(data.active || null);
        setUnclosedCashierDays(Array.isArray(data.unclosedDays) ? data.unclosedDays : []);
        return data.active || null;
      }
    } catch (e) {
      console.error('Failed to fetch active cashier closing:', e);
    }
    return null;
  };

  const startCashierBusinessDay = async (data: { opening_float?: number; business_date?: string; cashier_id?: string; cashier_name?: string }): Promise<CashierDailyClosing> => {
    const payload = {
      ...data,
      cashier_id: data.cashier_id || currentUser?.id,
      cashier_name: data.cashier_name || currentUser?.name,
    };
    const res = await authFetch('/api/cashier-closings/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start cashier business day');
    }
    const closing = await res.json();
    setActiveCashierClosing(closing);
    await fetchAllData();
    return closing;
  };

  const addCashierCashExpense = async (closingId: string, expenseData: { category?: string; description: string; amount: number; receipt_reference?: string }): Promise<CashierDailyClosing> => {
    const res = await authFetch(`/api/cashier-closings/${closingId}/expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expenseData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add cash expense to closing');
    }
    const updated = await res.json();
    setActiveCashierClosing(updated);
    await fetchAllData();
    return updated;
  };

  const submitCashierDailyClosing = async (closingId: string, data: { actual_cash: number; denominations?: any; closing_notes?: string }): Promise<CashierDailyClosing> => {
    const res = await authFetch(`/api/cashier-closings/${closingId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit daily closing');
    }
    const updated = await res.json();
    setActiveCashierClosing(null);
    await fetchAllData();
    return updated;
  };

  const reviewCashierDailyClosing = async (closingId: string, data: { action: 'approve' | 'reject'; review_notes?: string }): Promise<CashierDailyClosing> => {
    const res = await authFetch(`/api/cashier-closings/${closingId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to review daily closing');
    }
    const updated = await res.json();
    await fetchAllData();
    return updated;
  };

  const fetchPaymentAccounts = async () => {
    try {
      const res = await authFetch('/api/accounting/payment-accounts');
      if (res.ok) {
        const data = await res.json();
        setPaymentAccounts(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch payment accounts:', e);
    }
  };

  const fetchPaymentAccountStatement = async (id: string, startDate?: string, endDate?: string) => {
    const q = new URLSearchParams();
    if (startDate) q.set('start_date', startDate);
    if (endDate) q.set('end_date', endDate);
    const res = await authFetch(`/api/accounting/payment-accounts/${id}/statement${q.toString() ? '?' + q.toString() : ''}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch statement');
    }
    return res.json();
  };

  const createPaymentAccount = async (data: any): Promise<PaymentAccount> => {
    const res = await authFetch('/api/accounting/payment-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create payment account');
    }
    const acc = await res.json();
    await fetchAllData();
    return acc;
  };

  const updatePaymentAccount = async (id: string, data: any): Promise<PaymentAccount> => {
    const res = await authFetch(`/api/accounting/payment-accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update payment account');
    }
    const acc = await res.json();
    await fetchAllData();
    return acc;
  };

  const togglePaymentAccountActive = async (id: string, isActive: boolean): Promise<PaymentAccount> => {
    const res = await authFetch(`/api/accounting/payment-accounts/${id}/toggle-active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to toggle payment account status');
    }
    const acc = await res.json();
    await fetchAllData();
    return acc;
  };

  const transferFunds = async (data: any): Promise<any> => {
    const res = await authFetch('/api/accounting/payment-accounts/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to transfer funds');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const depositFunds = async (data: any): Promise<any> => {
    const res = await authFetch('/api/accounting/payment-accounts/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to deposit funds');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const withdrawFunds = async (data: any): Promise<any> => {
    const res = await authFetch('/api/accounting/payment-accounts/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to withdraw funds');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const fetchFundTransfers = async () => {
    try {
      const res = await authFetch('/api/accounting/transfers');
      if (res.ok) {
        const data = await res.json();
        setFundTransfers(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch transfers:', e);
    }
  };

  const fetchManualAdjustments = async (paymentAccountId?: string) => {
    try {
      const q = paymentAccountId ? `?payment_account_id=${paymentAccountId}` : '';
      const res = await authFetch(`/api/accounting/manual-adjustments${q}`);
      if (res.ok) {
        const data = await res.json();
        setManualAdjustments(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch manual adjustments:', e);
    }
  };

  const createManualAdjustment = async (data: any): Promise<any> => {
    const res = await authFetch('/api/accounting/manual-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create manual adjustment');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const voidManualAdjustment = async (id: string, reason: string): Promise<any> => {
    const res = await authFetch(`/api/accounting/manual-adjustments/${id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to void manual adjustment');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const recordExpense = async (data: any): Promise<ExpenseRecord> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/accounting/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record expense');
    }
    const exp = await res.json();
    await fetchAllData();
    return exp;
  };

  const voidExpense = async (id: string, reason: string): Promise<ExpenseRecord> => {
    const payload = {
      reason,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/accounting/expenses/${id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to void expense');
    }
    const exp = await res.json();
    await fetchAllData();
    return exp;
  };

  const createEmployee = async (data: any): Promise<Employee> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create employee');
    }
    const emp = await res.json();
    await fetchAllData();
    return emp;
  };

  const updateEmployee = async (id: string, data: any): Promise<Employee> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update employee');
    }
    const emp = await res.json();
    await fetchAllData();
    return emp;
  };

  const processPayroll = async (data: any): Promise<PayrollRecord> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/accounting/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to process payroll');
    }
    const pr = await res.json();
    await fetchAllData();
    return pr;
  };

  const fetchPnlReport = async (startDate?: string, endDate?: string): Promise<ProfitLossReport> => {
    const query = new URLSearchParams();
    if (startDate) query.set('start_date', startDate);
    if (endDate) query.set('end_date', endDate);
    const res = await fetch(`/api/accounting/reports/pnl?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch P&L report');
    const data = await res.json();
    setPnlReport(data);
    return data;
  };

  const fetchBalanceSheetReport = async (asOfDate?: string): Promise<BalanceSheetReport> => {
    const query = new URLSearchParams();
    if (asOfDate) query.set('as_of_date', asOfDate);
    const res = await fetch(`/api/accounting/reports/balance-sheet?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch Balance Sheet report');
    const data = await res.json();
    setBalanceSheetReport(data);
    return data;
  };

  const fetchPaymentAccountsReport = async (filters?: any): Promise<PaymentAccountsReportData> => {
    const query = new URLSearchParams();
    if (filters?.account_id) query.set('account_id', filters.account_id);
    if (filters?.account_type) query.set('account_type', filters.account_type);
    if (filters?.start_date) query.set('start_date', filters.start_date);
    if (filters?.end_date) query.set('end_date', filters.end_date);
    if (filters?.transaction_type) query.set('transaction_type', filters.transaction_type);
    if (filters?.user_name) query.set('user_name', filters.user_name);
    if (filters?.search) query.set('search', filters.search);

    const res = await fetch(`/api/accounting/reports/payment-accounts?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch Payment Accounts report');
    return await res.json();
  };

  const fetchDailyBusinessControlReport = async (filters?: any): Promise<DailyBusinessControlReportData> => {
    const query = new URLSearchParams();
    if (filters?.start_date) query.set('start_date', filters.start_date);
    if (filters?.end_date) query.set('end_date', filters.end_date);
    if (filters?.business_date) query.set('business_date', filters.business_date);

    const res = await fetch(`/api/accounting/reports/daily-control?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch Daily Business Control report');
    return await res.json();
  };

  const fetchFinancialCrossCheck = async (): Promise<FinancialCrossCheckReport> => {
    const res = await fetch('/api/accounting/reports/cross-check', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch Financial Cross-Check report');
    return await res.json();
  };

  const createApprovalRequest = async (data: any): Promise<ApprovalRequest> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit approval request');
    }
    const req = await res.json();
    await fetchAllData();
    return req;
  };

  const reviewApprovalRequest = async (id: string, decision: 'approved' | 'rejected', notes?: string): Promise<ApprovalRequest> => {
    const payload = {
      decision,
      review_notes: notes,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Owner',
    };
    const res = await fetch(`/api/approvals/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Failed to ${decision} approval request`);
    }
    const req = await res.json();
    await fetchAllData();
    return req;
  };

  const recordCompetitorPrice = async (data: any): Promise<CompetitorPriceRecord> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/pricing/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to log competitor price');
    }
    const rec = await res.json();
    await fetchAllData();
    return rec;
  };

  const deleteCompetitorPrice = async (id: string): Promise<void> => {
    const payload = {
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch(`/api/pricing/competitors/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete competitor price');
    }
    await fetchAllData();
  };

  const savePricingRule = async (data: any): Promise<PricingRule> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Owner',
    };
    const res = await fetch('/api/pricing/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save pricing rule');
    }
    const rule = await res.json();
    await fetchAllData();
    return rule;
  };

  const createPricingCampaign = async (data: any): Promise<PricingCampaign> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Owner',
    };
    const res = await fetch('/api/pricing/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create pricing campaign');
    }
    const cmp = await res.json();
    await fetchAllData();
    return cmp;
  };

  const togglePricingCampaign = async (id: string, active: boolean): Promise<PricingCampaign> => {
    const payload = {
      active,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Owner',
    };
    const res = await fetch(`/api/pricing/campaigns/${id}/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to toggle campaign');
    }
    const cmp = await res.json();
    await fetchAllData();
    return cmp;
  };

  const applyRepricing = async (productId: string, newPrice: number, reason: string): Promise<Product> => {
    const payload = {
      product_id: productId,
      new_price: newPrice,
      reason,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Owner',
    };
    const res = await fetch('/api/pricing/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to apply repricing');
    }
    const prod = await res.json();
    await fetchAllData();
    return prod;
  };

  const generate2FASetup = async (userId: string): Promise<{ secret: string; qr_code_uri: string; backup_codes: string[] }> => {
    const res = await fetch('/api/security/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate 2FA setup');
    }
    return await res.json();
  };

  const verifyAndEnable2FA = async (data: any): Promise<User> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Staff',
    };
    const res = await fetch('/api/security/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to verify TOTP code');
    }
    const user = await res.json();
    await fetchAllData();
    return user;
  };

  const disable2FA = async (userId: string): Promise<User> => {
    const payload = {
      user_id: userId,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Owner',
    };
    const res = await fetch('/api/security/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to disable 2FA');
    }
    const user = await res.json();
    await fetchAllData();
    return user;
  };

  const createBackup = async (): Promise<BackupSnapshot> => {
    const payload = {
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Owner',
    };
    const res = await fetch('/api/backups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create system backup');
    }
    const snapshot = await res.json();
    await fetchAllData();
    return snapshot;
  };

  const downloadBackup = (id: string) => {
    const link = document.createElement('a');
    link.href = `/api/backups/${id}/download`;
    link.download = `mirage_backup_${id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const restoreBackup = async (snapshotData: any): Promise<any> => {
    const payload = {
      snapshot_data: snapshotData,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Owner',
    };
    const res = await fetch('/api/backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to restore database snapshot');
    }
    const result = await res.json();
    await fetchAllData();
    return result;
  };

  const updateSecuritySettings = async (data: Partial<SecuritySettings>): Promise<SecuritySettings> => {
    const payload = {
      ...data,
      actor_id: currentUser?.id || 'system',
      actor_name: currentUser?.name || 'Owner',
    };
    const res = await fetch('/api/security/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update security settings');
    }
    const updated = await res.json();
    await fetchAllData();
    return updated;
  };

  const fetchSystemHealth = async (): Promise<SystemHealthStatus> => {
    const res = await fetch('/api/system/health');
    if (!res.ok) throw new Error('Failed to fetch system health');
    const health = await res.json();
    setSystemHealth(health);
    return health;
  };

  const markNotificationsRead = async () => {
    await fetch('/api/notifications/mark-read', { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteOrder = async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_id: currentUser?.id || 'usr_owner', actor_name: currentUser?.name || 'Staff' }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const bulkDeleteOrders = async (orderIds: string[]) => {
    const res = await fetch('/api/orders/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_ids: orderIds, actor_id: currentUser?.id || 'usr_owner', actor_name: currentUser?.name || 'Staff' }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Bulk delete failed');
    setOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
  };

  return (
    <AppContext.Provider
      value={{
        products,
        orders,
        customers,
        courierBookings,
        reconciliationSummary,
        courierWebhookLogs,
        courierApiConfig,
        suppliers,
        purchaseOrders,
        purchaseReturns,
        customerReturns,
        returnsSummary,
        cashRegisterLogs,
        expenses,
        employees,
        payrollRecords,
        approvalRequests,
        approvalSummary,
        competitorPrices,
        pricingRules,
        pricingCampaigns,
        repricingSuggestions,
        backups,
        securitySettings,
        systemHealth,
        pnlReport,
        balanceSheetReport,
        stockMovements,
        batches,
        damagedStock,
        accounts,
        journalEntries,
        auditLogs,
        settings,
        warehouses,
        users,
        packagingMaterials,
        packagingMovements,
        notifications,
        isLoading,
        isInitialized,
        activePath,
        setActivePath,
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        createOrder,
        editOrder,
        movePreOrderToToday,
        bulkMovePreOrdersToToday,
        cancelOrder,
        parseMessenger,
        receiveStock,
        setOpeningStock,
        setOpeningBalance,
        transferStock,
        packOrder,
        bookCourier,
        recordLabelPrinted,
        verifyTrackingBarcode,
        dispatchOrder,
        syncCourierStatus,
        reconcileCourierPayout,
        updateCourierActualChargeManual,
        resolveCourierChargeConflict,
        updateReturnCourierFeeManual,
        calculateCourierCharge,
        syncAllCourierBookings,
        simulateCourierWebhook,
        updateCourierApiConfig,
        testCourierApiConnection,
        processCustomerReturn,
        reconcileDailyCashRegister,
        cashierClosings,
        activeCashierClosing,
        unclosedCashierDays,
        paymentAccounts,
        fundTransfers,
        manualAdjustments,
        fetchPaymentAccounts,
        fetchPaymentAccountStatement,
        createPaymentAccount,
        updatePaymentAccount,
        togglePaymentAccountActive,
        transferFunds,
        depositFunds,
        withdrawFunds,
        fetchFundTransfers,
        fetchManualAdjustments,
        createManualAdjustment,
        voidManualAdjustment,
        fetchCashierClosings,
        fetchActiveCashierClosing,
        startCashierBusinessDay,
        addCashierCashExpense,
        submitCashierDailyClosing,
        reviewCashierDailyClosing,
        recordExpense,
        voidExpense,
        createEmployee,
        updateEmployee,
        processPayroll,
        createApprovalRequest,
        reviewApprovalRequest,
        recordCompetitorPrice,
        deleteCompetitorPrice,
        savePricingRule,
        createPricingCampaign,
        togglePricingCampaign,
        applyRepricing,
        generate2FASetup,
        verifyAndEnable2FA,
        disable2FA,
        createBackup,
        downloadBackup,
        restoreBackup,
        updateSecuritySettings,
        fetchSystemHealth,
        fetchPnlReport,
        fetchBalanceSheetReport,
        fetchPaymentAccountsReport,
        fetchDailyBusinessControlReport,
        fetchFinancialCrossCheck,
        postMovement,
        postJournalEntry,
        createProduct,
        updateProduct,
        deleteProduct,
        importBulkCsv,
        createSupplier,
        updateSupplier,
        recordSupplierPayment,
        fetchSupplierStatement,
        createPurchaseOrder,
        updatePurchaseOrderStatus,
        receivePurchaseOrderItems,
        createPurchaseReturn,
        updateSettings,
        createPackagingMaterial,
        updatePackagingMaterial,
        receivePackagingStock,
        markNotificationsRead,
        refreshAll: fetchAllData,
        recordOrderPayment,
        deleteOrder,
        bulkDeleteOrders,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};




export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
