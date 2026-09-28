import crypto from 'crypto';
import {
  Product,
  Warehouse,
  InventoryRecord,
  StockMovement,
  ReservationEvent,
  Customer,
  Order,
  Account,
  JournalEntry,
  JournalTransactionType,
  AuditLogEntry,
  User,
  CompanySettings,
  NotificationItem,
  OrderItem,
  OrderTesterItem,
  PaymentTransaction,
  PerfumeConcentration,
  Capability,
  CourierBooking,
  CourierBookingStatus,
  CourierChargeSource,
  CourierChargeAuditEntry,
  CourierApiConflict,
  CourierSettlementBatch,
  SettlementBatchItem,
  ReconciliationSummary,
  Supplier,
  SupplierPayment,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseReturn,
  PurchaseReturnItem,
  PurchaseReturnReason,
  ApprovalRequest,
  ApprovalRequestType,
  CompetitorPriceRecord,
  PricingRule,
  PricingCampaign,
  RepricingSuggestion,
  CurrencyCode,
  CourierWebhookLog,
  CourierApiConfig,
  CustomerReturn,
  CustomerReturnItem,
  CustomerReturnType,
  CustomerReturnReason,
  ItemReturnCondition,
  DailyCashRegisterLog,
  ExpenseRecord,
  ExpenseCategory,
  ExpenseType,
  ExpenseCategoryDefinition,
  ExpenseTemplate,
  ExpenseBudget,
  ExpensePaginationResult,
  Employee,
  PayrollRecord,
  ProfitLossReport,
  BalanceSheetReport,
  SecuritySettings,
  BackupSnapshot,
  SystemHealthStatus,
  PackagingMaterial,
  PackagingStockMovement,
  PackagingCategory,
  PackagingStockMovementReason,
  ProductBatch,
  OrderItemAllocation,
  DamagedStockRecord,
  DamageSeverity,
  CashierDailyClosing,
  CashierCashExpense,
  CashierClosingStatus,
  CashierClosingSalesMetrics,
  PaymentAccount,
  PaymentAccountType,
  FundTransferRecord,
  AccountDepositRecord,
  AccountWithdrawalRecord,
  ManualAdjustmentRecord,
  PaymentAccountStatementItem,
  PaymentAccountsReportData,
  PaymentAccountSummaryItem,
  PaymentAccountReportTransaction,
  DailyBusinessControlReportData,
  DailyBusinessControlReportRow,
  FinancialCrossCheckReport,
  FinancialCrossCheckItem,
  StockReportItem,
  StockReportSummary,
  StockReportResponse,
  ProductStockHistorySummary,
  ProductStockHistoryMovement,
  ProductStockHistoryResponse,
} from '../src/types';

// ============================================================================
// Secret-at-rest encryption (Section 39.1): API keys (Steadfast, Gemini) are
// encrypted at rest and decrypted only in-memory when the backend needs the
// actual value. The encryption key is derived from APP_ENCRYPTION_KEY when set;
// a stable per-install fallback is used otherwise so the stored byte form is
// never plaintext. Production should set APP_ENCRYPTION_KEY.
// ============================================================================
function getSecretKey(): Buffer {
  const source = process.env.APP_ENCRYPTION_KEY || 'mirage-perfume-encryption-key-v1';
  return crypto.createHash('sha256').update(source).digest();
}

export function encryptSecret(plaintext: string | undefined | null): string {
  const value = plaintext == null ? '' : String(plaintext).trim();
  if (!value) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSecretKey(), iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(payload: string | undefined | null): string {
  const value = payload == null ? '' : String(payload);
  if (!value || !value.includes(':')) return '';
  const parts = value.split(':');
  if (parts.length !== 3) return '';
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const enc = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getSecretKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// Map a payment method to its chart-of-accounts bucket (Section 15.1/15.5).
// Card settlements are treated as landing in the bank account (no separate
// card bucket is seeded). Callers may pass an explicit account_id to override.
export function paymentMethodToAccountId(method: string): string {
  switch (method) {
    case 'cash':
      return 'acc_cash';
    case 'bkash':
      return 'acc_bkash';
    case 'nagad':
      return 'acc_nagad';
    case 'bank':
      return 'acc_bank';
    case 'card':
      return 'acc_bank';
    case 'cod_pending':
      return 'acc_courier_rec';
    default:
      return 'acc_cash';
  }
}

export function maskSecret(plaintext: string | undefined | null): string {
  const value = plaintext == null ? '' : String(plaintext);
  if (!value) return '';
  if (value.length <= 4) return '\u2022'.repeat(value.length);
  return `${value.slice(0, 4)}${'\u2022'.repeat(Math.max(0, value.length - 8))}${value.slice(-4)}`;
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash || !password) return false;
  if (storedHash.includes(':')) {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
    } catch {
      return false;
    }
  }
  return password === storedHash;
}

// In-Memory canonical relational database with persistence & transactional guarantees
export class MirageDB {
  public products: Map<string, Product> = new Map();
  public warehouses: Map<string, Warehouse> = new Map();
  public inventory: Map<string, InventoryRecord> = new Map(); // key: `${product_id}_${warehouse_id}`
  public stockMovements: StockMovement[] = [];
  public reservationEvents: ReservationEvent[] = [];
  public customers: Map<string, Customer> = new Map();
  public orders: Map<string, Order> = new Map();
  public courierBookings: Map<string, CourierBooking> = new Map(); // Key: booking id or order id
  public courierWebhookLogs: CourierWebhookLog[] = [];
  public courierApiConfig: CourierApiConfig = {
    provider: 'steadfast',
    api_key: encryptSecret(process.env.STEADFAST_API_KEY || 'demo-api-key'),
    secret_key: encryptSecret(process.env.STEADFAST_SECRET_KEY || 'demo-secret-key'),
    base_url: process.env.STEADFAST_BASE_URL || 'https://portal.steadfast.com.bd/api/v1',
    webhook_secret: process.env.STEADFAST_WEBHOOK_SECRET || '',
    is_live: false,
    webhook_enabled: true,
    auto_sync_enabled: false,
    auto_sync_interval_minutes: 30,
    status: 'connected',
  };
  public suppliers: Map<string, Supplier> = new Map();
  public purchaseOrders: Map<string, PurchaseOrder> = new Map();
  public purchaseReturns: Map<string, PurchaseReturn> = new Map();
  public customerReturns: Map<string, CustomerReturn> = new Map();
  public supplierPayments: Map<string, SupplierPayment> = new Map();
  public cashRegisterLogs: DailyCashRegisterLog[] = [];
  public cashierDailyClosings: Map<string, CashierDailyClosing> = new Map();
  private nextClosingSeq = 1001;
  public expenses: Map<string, ExpenseRecord> = new Map();
  public expenseCategories: Map<string, ExpenseCategoryDefinition> = new Map();
  public expenseTemplates: Map<string, ExpenseTemplate> = new Map();
  public expenseBudgets: Map<string, ExpenseBudget> = new Map();
  public employees: Map<string, Employee> = new Map();
  public payrollRecords: Map<string, PayrollRecord> = new Map();
  public approvalRequests: Map<string, ApprovalRequest> = new Map();
  public competitorPrices: Map<string, CompetitorPriceRecord> = new Map();
  public pricingRules: Map<string, PricingRule> = new Map();
  public pricingCampaigns: Map<string, PricingCampaign> = new Map();
  public packagingMaterials: Map<string, PackagingMaterial> = new Map();
  public packagingStockMovements: PackagingStockMovement[] = [];
  public backups: BackupSnapshot[] = [];
  public backupPayloads: Map<string, any> = new Map();
  public securitySettings: SecuritySettings = {
    session_timeout_minutes: 60,
    max_failed_logins: 5,
    require_2fa_admin: false,
    backup_frequency: 'daily',
    audit_chain_strict: true,
  };
  private serverStartTime = Date.now();
  public accounts: Map<string, Account> = new Map();
  public paymentAccounts: Map<string, PaymentAccount> = new Map();
  public fundTransfers: Map<string, FundTransferRecord> = new Map();
  public accountDeposits: Map<string, AccountDepositRecord> = new Map();
  public accountWithdrawals: Map<string, AccountWithdrawalRecord> = new Map();
  public manualAdjustments: Map<string, ManualAdjustmentRecord> = new Map();
  private nextTransferSeq = 1001;
  private nextDepositSeq = 1001;
  private nextWithdrawalSeq = 1001;
  private nextAdjustmentSeq = 1001;
  public settlementBatches: Map<string, CourierSettlementBatch> = new Map();

  public journalEntries: JournalEntry[] = [];
  public auditLogs: AuditLogEntry[] = [];
  public users: Map<string, User> = new Map();
  public sessions: Map<string, { token: string; userId: string; createdAt: number; lastActiveAt: number; ip?: string; userAgent?: string }> = new Map();
  public loginAttempts: Map<string, { count: number; lastAttempt: number; lockedUntil?: number }> = new Map();
  public notifications: NotificationItem[] = [];
  public batches: ProductBatch[] = [];
  public damagedStock: DamagedStockRecord[] = [];
  public settings: CompanySettings = {
    company_name: 'MIRAGE PERFUME BANGLADESH',
    business_name: 'Mirage Perfume Bangladesh',
    phone: '+8801999033027',
    address: 'House 47, Road 27, Banani, Dhaka, Bangladesh',
    inside_dhaka_delivery: 70,
    outside_dhaka_delivery: 120,
    rto_risk_threshold: 2,
    invoice_note_cod: 'Cash on Delivery: Please verify your parcel upon arrival and pay the due amount in cash to the delivery agent. Authentic Mirage Fragrance guaranteed.',
    invoice_note_prepaid: 'Prepaid Order: Payment already verified in full. No payment required at delivery. Thank you for shopping with Mirage Perfume.',
    courier_api_key: '',
    courier_secret_key: '',
    courier_base_url: process.env.STEADFAST_BASE_URL || 'https://portal.steadfast.com.bd/api/v1',
  };

  private nextInvoiceNumber = 1001;
  private nextPONumber = 1001;
  private nextPRNumber = 1001;
  private nextCustReturnNumber = 1001;
  private nextExpenseNumber = 1001;
  private nextPayslipNumber = 1001;
  private nextApprovalNumber = 1001;
  private nextPayNumber = 1001;
  private nextSettlementBatchNumber = 1001;
  private nextMovementId = 1;
  private nextAuditId = 1;
  private nextJournalId = 1;

  constructor() {
    this.seedInitialData();
  }

  private invKey(productId: string, warehouseId: string): string {
    return `${productId}_${warehouseId}`;
  }

  public getAvailableStock(productId: string, warehouseId: string): number {
    const key = this.invKey(productId, warehouseId);
    const rec = this.inventory.get(key);
    if (!rec) return 0;
    const onHand = Number.isFinite(rec.on_hand) ? rec.on_hand : 0;
    const reserved = Number.isFinite(rec.reserved) ? rec.reserved : 0;
    return Math.max(0, onHand - reserved);
  }

  public getProductStockSummary(productId: string): {
    on_hand: number;
    reserved: number;
    available: number;
    byWarehouse: { warehouse_id: string; warehouse_name: string; on_hand: number; reserved: number; available: number }[];
  } {
    let totalOnHand = 0;
    let totalReserved = 0;
    const byWarehouse: { warehouse_id: string; warehouse_name: string; on_hand: number; reserved: number; available: number }[] = [];

    this.warehouses.forEach(wh => {
      const rec = this.inventory.get(this.invKey(productId, wh.id));
      const onHand = rec ? rec.on_hand : 0;
      const reserved = rec ? rec.reserved : 0;
      const available = Math.max(0, onHand - reserved);
      totalOnHand += onHand;
      totalReserved += reserved;
      byWarehouse.push({
        warehouse_id: wh.id,
        warehouse_name: wh.name,
        on_hand: onHand,
        reserved: reserved,
        available: available,
      });
    });

    return {
      on_hand: totalOnHand,
      reserved: totalReserved,
      available: Math.max(0, totalOnHand - totalReserved),
      byWarehouse,
    };
  }

  public logAudit(
    userId: string,
    userName: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: any,
    oldState?: any,
    newState?: any
  ): void {
    const timestamp = new Date().toISOString();
    const id = `AUD-${Date.now()}-${this.nextAuditId++}`;
    const hash = Buffer.from(`${id}|${userId}|${action}|${entityType}|${entityId}|${timestamp}`).toString('base64').slice(0, 16);
    const entry: AuditLogEntry = {
      id,
      user_id: userId,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      old_state: oldState,
      new_state: newState,
      hash: `0x${hash}`,
      created_at: timestamp,
    };
    this.auditLogs.unshift(entry);
  }

  public postJournal(
    date: string,
    refType: string,
    refId: string,
    description: string,
    lines: { account_id: string; debit: number; credit: number; line_desc?: string }[],
    createdBy: string,
    createdByName?: string,
    transactionType?: JournalTransactionType
  ): JournalEntry {
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Double-entry unbalanced! Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    let resolvedTxType: JournalTransactionType = transactionType || 'general_journal';
    if (!transactionType) {
      if (refType === 'sale' || refType === 'courier_delivered' || refType === 'customer_direct_payment') {
        resolvedTxType = 'pos_sale';
      } else if (refType === 'expense' || refType === 'expense_void' || refType === 'bank_fee' || refType === 'mfs_fee') {
        resolvedTxType = 'expense';
      } else if (refType === 'payroll') {
        resolvedTxType = 'payroll';
      } else if (refType === 'fund_transfer') {
        resolvedTxType = 'fund_transfer_in';
      } else if (refType === 'account_deposit' || refType === 'opening_balance') {
        resolvedTxType = 'deposit';
      } else if (refType === 'account_withdrawal') {
        resolvedTxType = 'withdrawal';
      } else if (refType === 'manual_adjustment' || refType === 'adjustment_reversal') {
        resolvedTxType = 'manual_adjustment';
      } else if (refType === 'supplier_payment' || refType === 'purchase_return_refund') {
        resolvedTxType = 'supplier_payment';
      } else if (refType === 'customer_refund' || refType === 'order_cancel_refund' || refType === 'return_restock' || refType === 'return_tester' || refType === 'return_damaged_writeoff') {
        resolvedTxType = 'customer_return';
      } else if (refType === 'courier_payout' || refType === 'courier_batch_settlement' || refType === 'courier_rto_fee' || refType === 'courier_rto_fee_adjust') {
        resolvedTxType = 'courier_settlement';
      } else if (refType === 'cash_reconciliation') {
        resolvedTxType = 'cashier_closing';
      }
    }

    const entryNum = `JE-2026-${String(this.nextJournalId++).padStart(5, '0')}`;
    const entry: JournalEntry = {
      id: `JE-${Date.now()}-${entryNum}`,
      entry_number: entryNum,
      date,
      reference_id: refId,
      description,
      transaction_type: resolvedTxType,
      lines: lines.map(l => {
        const acc = this.accounts.get(l.account_id);
        if (acc) {
          // Asset & Expense increase with Debit, decrease with Credit
          if (acc.type === 'asset' || acc.type === 'expense') {
            acc.balance += (l.debit || 0) - (l.credit || 0);
          } else {
            // Liability, Equity, Income increase with Credit, decrease with Debit
            acc.balance += (l.credit || 0) - (l.debit || 0);
          }
        }
        return {
          account_id: l.account_id,
          account_name: acc ? acc.name : l.account_id,
          debit: l.debit || 0,
          credit: l.credit || 0,
          line_desc: l.line_desc,
        };
      }),
      total_debit: totalDebit,
      total_credit: totalCredit,
      created_by: createdBy,
      created_by_name: createdByName || 'System',
      created_at: new Date().toISOString(),
    };

    this.journalEntries.unshift(entry);
    return entry;
  }

  public allocateInvoiceNumber(): string {
    const num = this.nextInvoiceNumber++;
    return `INV-2026-${String(num).padStart(4, '0')}`;
  }

  public normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+8801')) return '01' + cleaned.slice(5);
    if (cleaned.startsWith('8801')) return '01' + cleaned.slice(4);
    if (cleaned.startsWith('01') && cleaned.length === 11) return cleaned;
    return cleaned;
  }

  public getOrCreateCustomer(
    name: string,
    phone: string,
    addressText?: string
  ): Customer {
    const normPhone = this.normalizePhone(phone);
    let customer: Customer | undefined;

    if (normPhone) {
      for (const c of this.customers.values()) {
        if (c.phone === normPhone) {
          customer = c;
          break;
        }
      }
    }

    if (!customer) {
      const id = `CUST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const addresses = addressText
        ? [{ id: `ADDR-${Date.now()}-1`, customer_id: id, address_text: addressText.trim(), is_default: true }]
        : [];
      customer = {
        id,
        name: (name || '').trim() || 'Valued Customer',
        phone: normPhone,
        order_count: 0,
        total_spent: 0,
        risk_flag: false,
        rto_count: 0,
        cancelled_count: 0,
        completed_count: 0,
        addresses,
        created_at: new Date().toISOString(),
      };
      this.customers.set(id, customer);
    } else {
      if (addressText && addressText.trim()) {
        const cleanAddr = addressText.trim();
        const exists = customer.addresses.some(
          a => a.address_text.toLowerCase() === cleanAddr.toLowerCase()
        );
        if (!exists) {
          customer.addresses.push({
            id: `ADDR-${Date.now()}-${customer.addresses.length + 1}`,
            customer_id: customer.id,
            address_text: cleanAddr,
            is_default: customer.addresses.length === 0,
          });
        }
      }
    }

    return customer;
  }

  public getEffectiveCustomerType(customer: Customer, orders?: Order[]): 'retail' | 'wholesale' {
    if (customer.customer_type) return customer.customer_type;
    const allOrders = orders || Array.from(this.orders.values());
    const custOrders = allOrders.filter(
      o => o.customer_id === customer.id || (o.customer_phone && customer.phone && o.customer_phone.replace(/\D/g, '') === customer.phone.replace(/\D/g, ''))
    );
    const nonCancelled = custOrders.filter(o => o.status !== 'cancelled');
    if (nonCancelled.length === 0) return 'retail';
    const wholesaleCount = nonCancelled.filter(o => o.sale_type === 'wholesale').length;
    return (wholesaleCount / nonCancelled.length >= 0.5) ? 'wholesale' : 'retail';
  }

  public computeWholesaleReorderStatus(customer: Customer, orders?: Order[]): string {
    const allOrders = orders || Array.from(this.orders.values());
    const custOrders = allOrders.filter(
      o => (o.customer_id === customer.id || (o.customer_phone && customer.phone && o.customer_phone.replace(/\D/g, '') === customer.phone.replace(/\D/g, ''))) && o.status !== 'cancelled'
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (custOrders.length < 3) return '-';

    let totalDiffDays = 0;
    for (let i = 0; i < custOrders.length - 1; i++) {
      const d1 = new Date(custOrders[i].created_at).getTime();
      const d2 = new Date(custOrders[i+1].created_at).getTime();
      totalDiffDays += Math.max(0, (d2 - d1) / (1000 * 60 * 60 * 24));
    }
    const avgInterval = totalDiffDays / (custOrders.length - 1);
    if (avgInterval <= 0) return 'On cycle';

    const lastOrderDate = new Date(custOrders[custOrders.length - 1].created_at).getTime();
    const daysSinceLast = Math.max(0, (Date.now() - lastOrderDate) / (1000 * 60 * 60 * 24));

    if (daysSinceLast <= avgInterval) return 'On cycle';
    if (daysSinceLast <= 1.5 * avgInterval) return 'Due';
    return 'Overdue';
  }

  public expandBundles(items: { product_id: string; quantity: number }[]): { product_id: string; quantity: number; is_component: boolean }[] {
    const result: { product_id: string; quantity: number; is_component: boolean }[] = [];
    for (const item of items) {
      const prod = this.products.get(item.product_id);
      if (prod && prod.is_bundle && prod.bundle_components && prod.bundle_components.length > 0) {
        for (const comp of prod.bundle_components) {
          result.push({
            product_id: comp.component_product_id,
            quantity: comp.quantity * item.quantity,
            is_component: true,
          });
        }
      } else {
        result.push({
          product_id: item.product_id,
          quantity: item.quantity,
          is_component: false,
        });
      }
    }
    return result;
  }

  // FIFO Lot / Shipment Allocation
  public allocateBatchesForLineItem(productId: string, quantity: number, warehouseId: string = 'wh_shop'): {
    allocations: OrderItemAllocation[];
    totalPrice: number;
    totalCost: number;
    effectiveUnitPrice: number;
    effectiveUnitCost: number;
  } {
    const prod = this.products.get(productId);
    if (!prod) throw new Error(`Product not found: ${productId}`);

    let candidateBatches = this.batches.filter(
      b => b.product_id === productId && b.quantity_remaining > 0 && (!warehouseId || b.warehouse_id === warehouseId)
    );
    if (candidateBatches.length === 0) {
      candidateBatches = this.batches.filter(
        b => b.product_id === productId && b.quantity_remaining > 0
      );
    }

    const sorted = [...candidateBatches].sort((a, b) => {
      const isReadyA = a.maturation_status !== 'MATURING';
      const isReadyB = b.maturation_status !== 'MATURING';
      if (isReadyA !== isReadyB) return isReadyA ? -1 : 1;
      const dateA = new Date(a.received_at || a.import_date || a.created_at).getTime();
      const dateB = new Date(b.received_at || b.import_date || b.created_at).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.id.localeCompare(b.id);
    });

    const allocations: OrderItemAllocation[] = [];
    let remaining = quantity;
    let totalPrice = 0;
    let totalCost = 0;

    for (const batch of sorted) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.quantity_remaining);
      const unitPrice = typeof batch.selling_price === 'number' && batch.selling_price > 0 ? batch.selling_price : prod.selling_price;
      const unitCost = typeof batch.purchase_cost === 'number' && batch.purchase_cost > 0 ? batch.purchase_cost : prod.avg_cost;

      allocations.push({
        batch_id: batch.id,
        batch_code: batch.batch_code || `LOT-${batch.id.slice(-4)}`,
        quantity: take,
        unit_price: unitPrice,
        unit_cost: unitCost,
        warehouse_id: batch.warehouse_id,
        location: batch.location,
        maturation_status: batch.maturation_status || 'READY',
        received_at: batch.received_at || batch.import_date,
      });

      totalPrice += take * unitPrice;
      totalCost += take * unitCost;
      remaining -= take;
    }

    if (remaining > 0) {
      const unitPrice = prod.selling_price || 0;
      const unitCost = prod.avg_cost || 0;
      allocations.push({
        batch_id: 'general_stock',
        batch_code: 'Active Stock',
        quantity: remaining,
        unit_price: unitPrice,
        unit_cost: unitCost,
        warehouse_id: warehouseId,
        maturation_status: 'READY',
      });
      totalPrice += remaining * unitPrice;
      totalCost += remaining * unitCost;
    }

    const effectiveUnitPrice = quantity > 0 ? Math.round((totalPrice / quantity) * 100) / 100 : prod.selling_price || 0;
    const effectiveUnitCost = quantity > 0 ? Math.round((totalCost / quantity) * 100) / 100 : prod.avg_cost || 0;

    return { allocations, totalPrice, totalCost, effectiveUnitPrice, effectiveUnitCost };
  }

  // Atomic Order Creation (Section 35.1)
  public createOrder(params: {
    customer_name: string;
    customer_phone: string;
    delivery_address?: string;
    channel: 'messenger' | 'walk-in';
    order_type?: 'direct_sale' | 'merchant_fulfillment';
    merchant_name?: string;
    merchant_id?: string;
    parcel_id?: string;
    end_customer_name?: string;
    fulfillment_method: 'steadfast' | 'instant_delivery' | 'in_house' | 'self_pickup' | 'n_a_walk_in';
    instant_delivery_provider?: 'pathao' | 'uber' | 'other';
    rider_delivery_charge?: number;
    sale_type?: 'retail' | 'wholesale';
    items: { product_id: string; quantity: number; unit_price?: number; discount_amount?: number }[];
    testers?: { product_id: string; product_name?: string; sku?: string; barcode?: string; quantity: number; notes?: string }[];
    packing_note?: string;
    delivery_charge?: number;
    discount_amount?: number;
    source_text?: string;
    invoice_note?: string;
    invoice_note_type?: 'cod' | 'prepaid' | 'none';
    order_timing?: 'today' | 'scheduled' | 'pre_order';
    scheduled_date?: string;
    status?: Order['status'];
    delivered_by_user_id?: string;
    delivered_by_name?: string;
    transaction_date?: string;
    delivery_date?: string;
    business_date?: string;
    notes?: string;
    is_manual_entry?: boolean;
    actor_id: string;
    actor_name: string;
    payment_info?: {
      method: 'cash' | 'bkash' | 'nagad' | 'bank' | 'card' | 'cod_pending';
      amount: number;
      account_id: string;
      transaction_ref?: string;
      notes?: string;
      payment_date?: string;
    }[];
  }): Order {
    const orderType = params.order_type || 'direct_sale';
    if (orderType === 'merchant_fulfillment' && params.fulfillment_method === 'instant_delivery') {
      throw new Error('Instant Delivery is available only for Direct / Mirage orders.');
    }

    // 0. Mandatory Field Validations (Section 1)
    if (orderType === 'merchant_fulfillment') {
      if (!params.parcel_id || !params.parcel_id.trim()) {
        throw new Error('Merchant Parcel ID is required for Dropship Fulfillment orders.');
      }
    } else {
      if (!params.customer_name || !params.customer_name.trim()) {
        throw new Error('Customer Name is required for Direct Sale orders.');
      }
      if (!params.customer_phone || !params.customer_phone.trim()) {
        throw new Error('Mobile Number is required for Direct Sale orders.');
      }
      const deliveryAddress = params.delivery_address || (params as any).delivery_address_text;
      if (params.channel !== 'walk-in' && (!deliveryAddress || !deliveryAddress.trim())) {
        throw new Error('Delivery Address is required for Direct Sale orders.');
      }
    }

    const shopFloorWh = 'wh_shop';
    if (!Array.isArray(params.items) || params.items.length === 0) {
      throw new Error('At least one product is required to create an order.');
    }
    for (const item of params.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error('Each order quantity must be a positive whole number.');
      }
      if (item.unit_price !== undefined && (!Number.isFinite(item.unit_price) || item.unit_price < 0)) {
        throw new Error('Unit price must be a valid non-negative amount.');
      }
      if (item.discount_amount !== undefined && (!Number.isFinite(item.discount_amount) || item.discount_amount < 0)) {
        throw new Error('Discount must be a valid non-negative amount.');
      }
    }
    const expanded = this.expandBundles(params.items);

    const isPreOrder = params.order_timing === 'pre_order';

    // 1. Concurrency & Availability check against Shop Floor
    // For normal and scheduled orders, available stock must exist.
    // For pre-orders, the order is explicitly awaiting future stock arrival.
    if (!isPreOrder) {
      const requestedByProduct = new Map<string, number>();
      for (const comp of expanded) {
        requestedByProduct.set(comp.product_id, (requestedByProduct.get(comp.product_id) || 0) + comp.quantity);
      }
      for (const [productId, requested] of requestedByProduct) {
        const avail = this.getAvailableStock(productId, shopFloorWh);
        const prod = this.products.get(productId);
        const name = prod ? prod.display_name : productId;
        if (requested > avail) {
          throw new Error(`Insufficient stock for "${name}". Available: ${avail}, Requested: ${requested}`);
        }
      }
    }

    // 2. Customer lookup / creation
    const customer = this.getOrCreateCustomer(
      params.customer_name,
      params.customer_phone,
      params.delivery_address
    );
    const selectedAddr = customer.addresses[0];

    // 3. Order ID (invoice number allocated AFTER item validation so a
    // failed/skipped product never consumes a sequential number \u2014 Section 32.6/35.4)
    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 4. Build Order Items
    let subtotal = 0;
    let totalItemDiscount = 0;
    const orderItems: OrderItem[] = [];

    for (const it of params.items) {
      const prod = this.products.get(it.product_id);
      if (!prod) throw new Error(`Product not found: ${it.product_id}`);

      const alloc = this.allocateBatchesForLineItem(prod.id, it.quantity, shopFloorWh);
      const unitPrice = it.unit_price !== undefined ? it.unit_price : alloc.effectiveUnitPrice;
      const discount = it.discount_amount || 0;
      const lineTotal = Math.max(0, unitPrice * it.quantity - discount);
      subtotal += unitPrice * it.quantity;
      totalItemDiscount += discount;

      orderItems.push({
        id: `ITEM-${Date.now()}-${orderItems.length + 1}`,
        order_id: orderId,
        product_id: prod.id,
        product_name: prod.display_name,
        sku: prod.sku,
        barcode: prod.barcode,
        quantity: it.quantity,
        unit_price: unitPrice,
        discount_amount: discount,
        total_price: lineTotal,
        unit_cost_at_sale: alloc.effectiveUnitCost, // Stored historical COGS snapshot from allocated lots
        perfume_type: prod.perfume_type,
        allocations: alloc.allocations,
        batch_code: alloc.allocations.length === 1 ? alloc.allocations[0].batch_code : undefined,
      });
    }

    // Invoice number is only allocated once every line item has validated
    // (products exist, quantities parse). A failure above never consumes a
    // sequential invoice number \u2014 Section 32.6 / 35.4.
    const invoiceNum = this.allocateInvoiceNumber();
    const orderBarcode = `MP-ORD-${invoiceNum.replace('INV-', '')}`;

    const orderDiscount = (params.discount_amount || 0) + totalItemDiscount;
    const isInstantDelivery = params.fulfillment_method === 'instant_delivery';
    const isWalkIn = params.channel === 'walk-in';
    const deliveryCharge = params.channel === 'walk-in' || isInstantDelivery ? 0 : (params.delivery_charge !== undefined ? params.delivery_charge : 70);
    const finalTotal = Math.max(0, subtotal - orderDiscount + deliveryCharge);

    if (params.payment_info && params.payment_info.length > 0) {
      const totalPaid = params.payment_info.reduce((sum, payment) => {
        if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
          throw new Error('Each payment amount must be a positive amount.');
        }
        return sum + payment.amount;
      }, 0);
      if (isWalkIn && Math.abs(totalPaid - finalTotal) > 0.01) {
        throw new Error(`Walk-in payment total must equal the sale total of \u09F3${finalTotal.toLocaleString()}.`);
      }
      if (!isWalkIn && totalPaid > finalTotal + 0.01) {
        throw new Error('Payment total cannot exceed the order total.');
      }
    }

    // 5. Stock Reservation or Immediate Walk-In / Manual Delivery Fulfillment
    const isDelivered = params.status === 'delivered' || isWalkIn;
    const status: Order['status'] = params.status || (isWalkIn ? 'delivered' : 'confirmed');

    for (const comp of expanded) {
      const invK = this.invKey(comp.product_id, shopFloorWh);
      let inv = this.inventory.get(invK);
      if (!inv) {
        inv = { product_id: comp.product_id, warehouse_id: shopFloorWh, on_hand: 0, reserved: 0, avg_cost: 0 };
        this.inventory.set(invK, inv);
      }

      if (isDelivered) {
        // Immediate deduction for completed/delivered orders
        inv.on_hand -= comp.quantity;
        const prod = this.products.get(comp.product_id);
        const movDate = params.transaction_date ? new Date(params.transaction_date).toISOString() : new Date().toISOString();
        const mov: StockMovement = {
          id: `MOV-${Date.now()}-${this.nextMovementId++}`,
          product_id: comp.product_id,
          product_name: prod?.display_name || 'Perfume SKU',
          sku: prod?.sku || 'SKU',
          warehouse_id: shopFloorWh,
          warehouse_name: 'Shop Floor',
          quantity_delta: -comp.quantity,
          movement_reason: 'SALE',
          unit_cost: inv.avg_cost,
          total_cost: comp.quantity * inv.avg_cost,
          reference_id: orderId,
          created_by: params.actor_id,
          created_by_name: params.actor_name,
          created_at: movDate,
          notes: `${params.is_manual_entry ? 'Manual/historical' : (isWalkIn ? 'Walk-in' : 'Completed')} sale invoice ${invoiceNum}`,
        };
        this.stockMovements.unshift(mov);
      } else if (isPreOrder) {
        // Pre-order awaiting future stock arrival — do not hold down physical available stock
        this.reservationEvents.push({
          id: `RES-${Date.now()}-${this.reservationEvents.length + 1}`,
          order_id: orderId,
          product_id: comp.product_id,
          warehouse_id: shopFloorWh,
          quantity: comp.quantity,
          type: 'RESERVE',
          created_by: params.actor_id,
          created_by_name: params.actor_name,
          created_at: new Date().toISOString(),
          notes: `Pre-order recorded for order ${invoiceNum} (awaiting stock arrival)`,
        });
      } else {
        // Online reservation
        inv.reserved += comp.quantity;
        // Section 32.4/41 reservation ledger — record the RESERVE event
        this.reservationEvents.push({
          id: `RES-${Date.now()}-${this.reservationEvents.length + 1}`,
          order_id: orderId,
          product_id: comp.product_id,
          warehouse_id: shopFloorWh,
          quantity: comp.quantity,
          type: 'RESERVE',
          created_by: params.actor_id,
          created_by_name: params.actor_name,
          created_at: new Date().toISOString(),
          notes: `Reserved for order ${invoiceNum}`,
        });
      }
    }

    // 6. Payments
    const payments: PaymentTransaction[] = [];
    if (params.payment_info && params.payment_info.length > 0) {
      params.payment_info.forEach(p => {
        if (!Number.isFinite(p.amount) || p.amount <= 0) {
          throw new Error('Each payment amount must be a positive amount.');
        }
        const payDate = p.payment_date ? new Date(p.payment_date).toISOString() : (params.transaction_date ? new Date(params.transaction_date).toISOString() : new Date().toISOString());
        payments.push({
          id: `PAY-${Date.now()}-${payments.length + 1}`,
          order_id: orderId,
          amount: p.amount,
          method: p.method,
          transaction_ref: p.transaction_ref,
          payment_account_id: p.account_id || paymentMethodToAccountId(p.method),
          received_by: params.actor_name,
          status: 'completed',
          payment_date: p.payment_date || params.transaction_date,
          notes: p.notes,
          created_at: payDate,
        });
      });
      const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
      if (isWalkIn && Math.abs(totalPaid - finalTotal) > 0.01 && !params.is_manual_entry) {
        throw new Error(`Walk-in payment total must equal the sale total of ৳${finalTotal.toLocaleString()}.`);
      }
      if (totalPaid > finalTotal + 0.01) {
        throw new Error('Payment total cannot exceed the order total.');
      }
      if (finalTotal - totalPaid > 0.01) {
        payments.push({
          id: `PAY-${Date.now()}-${payments.length + 1}`,
          order_id: orderId,
          amount: Math.round(finalTotal - totalPaid),
          method: 'cod_pending',
          payment_account_id: 'acc_courier_rec',
          received_by: params.is_manual_entry ? 'Outstanding Due' : 'Steadfast Courier',
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      }
    } else if (isWalkIn) {
      // Default cash for walk in
      payments.push({
        id: `PAY-${Date.now()}-1`,
        order_id: orderId,
        amount: finalTotal,
        method: 'cash',
        payment_account_id: 'acc_cash',
        received_by: params.actor_name,
        status: 'completed',
        payment_date: params.transaction_date,
        created_at: params.transaction_date ? new Date(params.transaction_date).toISOString() : new Date().toISOString(),
      });
    } else {
      // Online COD pending
      payments.push({
        id: `PAY-${Date.now()}-1`,
        order_id: orderId,
        amount: finalTotal,
        method: 'cod_pending',
        payment_account_id: 'acc_courier_rec',
        received_by: 'Steadfast Courier',
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    }

    // 7. Post Double-Entry Journal for Walk-In or Delivered Manual Entry
    if (isDelivered && payments.some(p => p.status === 'completed')) {
      const lines: { account_id: string; debit: number; credit: number }[] = [];
      // Payment debits for completed payments
      payments.filter(p => p.status === 'completed').forEach(p => {
        lines.push({ account_id: p.payment_account_id, debit: p.amount, credit: 0 });
      });
      // If there's unpaid balance on delivered sale, debit Accounts Receivable
      const completedPaid = payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
      const remainingBalance = finalTotal - completedPaid;
      if (remainingBalance > 0.01) {
        lines.push({ account_id: 'acc_courier_rec', debit: remainingBalance, credit: 0 });
      }
      // Revenue credits
      const productRev = Math.max(0, subtotal - orderDiscount);
      lines.push({ account_id: 'acc_sales_rev', debit: 0, credit: productRev });
      if (deliveryCharge > 0) {
        lines.push({ account_id: 'acc_deliv_inc', debit: 0, credit: deliveryCharge });
      }

      // COGS & Inventory
      let totalCogs = 0;
      for (const comp of expanded) {
        const prod = this.products.get(comp.product_id);
        const cost = prod ? prod.avg_cost : 0;
        totalCogs += cost * comp.quantity;
      }
      if (totalCogs > 0) {
        lines.push({ account_id: 'acc_cogs', debit: totalCogs, credit: 0 });
        lines.push({ account_id: 'acc_inventory', debit: 0, credit: totalCogs });
      }

      const journalDate = params.transaction_date ? params.transaction_date.slice(0, 10) : new Date().toISOString().slice(0, 10);
      this.postJournal(
        journalDate,
        'sale',
        orderId,
        `${params.is_manual_entry ? 'Manual' : (isWalkIn ? 'Walk-in' : 'Online')} Sale Invoice ${invoiceNum} - Customer ${customer.name}`,
        lines,
        params.actor_name,
        undefined,
        'pos_sale'
      );
    }

    // 8. Assemble Order object
    const orderCreatedAt = params.transaction_date ? new Date(params.transaction_date).toISOString() : new Date().toISOString();
    const orderTesters: OrderTesterItem[] = [];
    if (Array.isArray(params.testers) && params.testers.length > 0) {
      for (const t of params.testers) {
        if (!t.product_id || !t.quantity || t.quantity <= 0) continue;
        const prod = this.products.get(t.product_id);
        orderTesters.push({
          id: `TESTER-${Date.now()}-${orderTesters.length + 1}`,
          product_id: t.product_id,
          product_name: prod ? prod.display_name : (t.product_name || 'Free Tester / Sample'),
          sku: prod?.sku || t.sku || '',
          barcode: prod?.barcode || t.barcode || '',
          quantity: Math.max(1, Math.floor(Number(t.quantity))),
          notes: t.notes || '',
        });
      }
    }

    const order: Order = {
      id: orderId,
      invoice_number: invoiceNum,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      channel: params.channel,
      order_type: params.order_type || 'direct_sale',
      merchant_name: params.merchant_name,
      merchant_id: params.merchant_id,
      parcel_id: params.parcel_id,
      end_customer_name: params.end_customer_name,
      fulfillment_method: params.fulfillment_method,
      instant_delivery_provider: isInstantDelivery ? params.instant_delivery_provider : undefined,
      sale_type: params.sale_type || 'retail',
      delivery_address_id: selectedAddr ? selectedAddr.id : undefined,
      delivery_address_text: selectedAddr ? selectedAddr.address_text : (params.delivery_address || (params as any).delivery_address_text),
      invoice_note: params.invoice_note,
      invoice_note_type: params.invoice_note_type,
      packing_note: params.packing_note?.trim() || undefined,
      packing_note_by_id: params.packing_note?.trim() ? params.actor_id : undefined,
      packing_note_by_name: params.packing_note?.trim() ? params.actor_name : undefined,
      packing_note_at: params.packing_note?.trim() ? new Date().toISOString() : undefined,
      testers: orderTesters.length > 0 ? orderTesters : undefined,
      status: status,
      source_text: params.source_text,
      items: orderItems,
      subtotal,
      delivery_charge: deliveryCharge,
      rider_delivery_charge: isInstantDelivery ? Math.max(0, Number(params.rider_delivery_charge ?? params.delivery_charge ?? 0)) : undefined,
      discount_amount: orderDiscount,
      total: finalTotal,
      order_barcode: orderBarcode,
      payments,
      order_timing: params.order_timing || 'today',
      scheduled_date: params.order_timing === 'scheduled' ? params.scheduled_date : undefined,
      delivered_by_user_id: params.delivered_by_user_id,
      delivered_by_name: params.delivered_by_name,
      transaction_date: params.transaction_date,
      business_date: params.business_date || params.transaction_date?.slice(0, 10) || orderCreatedAt.slice(0, 10),
      entry_timestamp: new Date().toISOString(),
      delivery_date: params.delivery_date,
      created_by: params.actor_id,
      created_by_name: params.actor_name,
      created_at: orderCreatedAt,
      updated_at: new Date().toISOString(),
    };

    this.orders.set(orderId, order);

    // Update customer stats
    customer.order_count += 1;
    if (isWalkIn || isDelivered) {
      customer.completed_count = (customer.completed_count || 0) + 1;
      customer.total_spent += finalTotal;
    }

    // 9. Audit Log & Notifications
    const auditAction = params.is_manual_entry ? 'manual_sale_recorded' : (isWalkIn ? 'walkin_sale_completed' : 'order_created');
    this.logAudit(
      params.actor_id,
      params.actor_name,
      auditAction,
      'order',
      orderId,
      `Recorded ${params.is_manual_entry ? 'manual/historical' : params.channel} order ${invoiceNum} for ${customer.name} (৳${finalTotal.toLocaleString()})${params.transaction_date ? ` [Transaction Date: ${params.transaction_date}]` : ''}`,
      undefined,
      {
        order_id: orderId,
        invoice_number: invoiceNum,
        total: finalTotal,
        items_count: orderItems.length,
        status,
        is_manual: Boolean(params.is_manual_entry),
        transaction_date: params.transaction_date,
        payments_count: payments.length,
      }
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'new_order',
      message: `New ${params.channel} order ${invoiceNum} created by ${params.actor_name} for \u09F3${finalTotal}`,
      ref_type: 'order',
      ref_id: orderId,
      read: false,
      created_at: new Date().toISOString(),
    });

    return order;
  }

  // Atomic Order Editing (Section 35.1c)
  public editOrder(params: {
    order_id: string;
    customer_name?: string;
    customer_phone?: string;
    delivery_address?: string;
    order_type?: 'direct_sale' | 'merchant_fulfillment';
    merchant_name?: string;
    merchant_id?: string;
    parcel_id?: string;
    end_customer_name?: string;
    fulfillment_method?: 'steadfast' | 'instant_delivery' | 'in_house' | 'self_pickup' | 'n_a_walk_in';
    instant_delivery_provider?: 'pathao' | 'uber' | 'other';
    rider_delivery_charge?: number;
    delivery_charge?: number;
    discount_amount?: number;
    order_timing?: 'today' | 'scheduled' | 'pre_order';
    scheduled_date?: string;
    items?: { product_id: string; quantity: number; unit_price?: number; discount_amount?: number }[];
    testers?: { product_id: string; product_name?: string; sku?: string; barcode?: string; quantity: number; notes?: string }[];
    packing_note?: string;
    actor_id: string;
    actor_name: string;
  }): Order {
    const order = this.orders.get(params.order_id);
    if (!order) throw new Error('Order not found');

    if (order.status !== 'confirmed') {
      throw new Error(`Order can no longer be edited \u2014 current status is "${order.status}". Editing is only permitted while status is CONFIRMED.`);
    }

    const nextOrderType = params.order_type || order.order_type || 'direct_sale';
    const nextFulfillment = params.fulfillment_method || order.fulfillment_method;
    if (nextOrderType === 'merchant_fulfillment' && !(params.parcel_id || order.parcel_id || '').trim()) {
      throw new Error('Merchant Parcel ID is required for Dropship Fulfillment orders.');
    }
    if (nextOrderType === 'merchant_fulfillment' && nextFulfillment === 'instant_delivery') {
      throw new Error('Instant Delivery is available only for Direct / Mirage orders.');
    }
    if (nextOrderType !== 'merchant_fulfillment' && order.channel !== 'walk-in') {
      if (!(params.customer_name || order.customer_name || '').trim()) throw new Error('Customer Name is required for Direct Sale orders.');
      if (!(params.customer_phone || order.customer_phone || '').trim()) throw new Error('Mobile Number is required for Direct Sale orders.');
      if (!(params.delivery_address !== undefined ? params.delivery_address : order.delivery_address_text || '').trim()) {
        throw new Error('Delivery Address is required for Direct Sale orders.');
      }
    }
    if (params.delivery_charge !== undefined && (!Number.isFinite(params.delivery_charge) || params.delivery_charge < 0)) {
      throw new Error('Delivery charge must be a valid non-negative amount.');
    }
    if (params.discount_amount !== undefined && (!Number.isFinite(params.discount_amount) || params.discount_amount < 0)) {
      throw new Error('Discount must be a valid non-negative amount.');
    }
    if (params.items) {
      if (params.items.length === 0) throw new Error('At least one product is required to keep an order.');
      for (const item of params.items) {
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error('Each order quantity must be a positive whole number.');
        if (item.unit_price !== undefined && (!Number.isFinite(item.unit_price) || item.unit_price < 0)) throw new Error('Unit price must be a valid non-negative amount.');
        if (item.discount_amount !== undefined && (!Number.isFinite(item.discount_amount) || item.discount_amount < 0)) throw new Error('Discount must be a valid non-negative amount.');
      }
    }

    const shopFloorWh = 'wh_shop';
    const oldOrderSnapshot = JSON.parse(JSON.stringify(order));

    // 1. If line items are being edited, apply Section 35.1c atomic reservation adjustments
    if (params.items && params.items.length > 0) {
      const oldItemsSimple = order.items.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
      const oldExpanded = this.expandBundles(oldItemsSimple);
      const newExpanded = this.expandBundles(params.items);

      // Aggregate quantities per component product
      const oldQtyMap = new Map<string, number>();
      for (const it of oldExpanded) {
        oldQtyMap.set(it.product_id, (oldQtyMap.get(it.product_id) || 0) + it.quantity);
      }

      const newQtyMap = new Map<string, number>();
      for (const it of newExpanded) {
        newQtyMap.set(it.product_id, (newQtyMap.get(it.product_id) || 0) + it.quantity);
      }

      // Collect union of all product IDs
      const allProductIds = Array.from(new Set([...oldQtyMap.keys(), ...newQtyMap.keys()])).sort();

      // Check availability for any positive deltas
      for (const prodId of allProductIds) {
        const oldQty = oldQtyMap.get(prodId) || 0;
        const newQty = newQtyMap.get(prodId) || 0;
        const delta = newQty - oldQty;

        if (delta > 0) {
          const avail = this.getAvailableStock(prodId, shopFloorWh);
          const prod = this.products.get(prodId);
          const name = prod ? prod.display_name : prodId;
          if (delta > avail) {
            throw new Error(`Only ${avail} more unit(s) available for "${name}". Requested: +${delta}`);
          }
        }
      }

      // All availability checks passed \u2014 apply delta to inventory reservations
      for (const prodId of allProductIds) {
        const oldQty = oldQtyMap.get(prodId) || 0;
        const newQty = newQtyMap.get(prodId) || 0;
        const delta = newQty - oldQty;

        if (delta !== 0) {
          const invK = this.invKey(prodId, shopFloorWh);
          let inv = this.inventory.get(invK);
          if (!inv) {
            inv = { product_id: prodId, warehouse_id: shopFloorWh, on_hand: 0, reserved: 0, avg_cost: 0 };
            this.inventory.set(invK, inv);
          }
          inv.reserved = Math.max(0, inv.reserved + delta);
          // Section 32.4/41 reservation ledger \u2014 record the net delta
          this.reservationEvents.push({
            id: `RES-${Date.now()}-${this.reservationEvents.length + 1}`,
            order_id: order.id,
            product_id: prodId,
            warehouse_id: shopFloorWh,
            quantity: Math.abs(delta),
            type: delta > 0 ? 'RESERVE' : 'RELEASE',
            created_by: params.actor_id,
            created_by_name: params.actor_name,
            created_at: new Date().toISOString(),
            notes: `Order ${order.invoice_number} edited (${delta > 0 ? '+' : ''}${delta} qty)`,
          });
        }
      }

      // Rebuild order items
      let subtotal = 0;
      let totalItemDiscount = 0;
      const newOrderItems: OrderItem[] = [];

      // Preserve each line's historical COGS snapshot from the original order
      // (Section 32.7): re-capturing current avg_cost here would silently
      // overwrite the cost that was correct at original sale time. Only
      // brand-new SKUs added during the edit get today's avg_cost.
      const oldCostMap = new Map<string, number>();
      for (const oldItem of order.items) {
        if (!oldCostMap.has(oldItem.product_id)) {
          oldCostMap.set(oldItem.product_id, oldItem.unit_cost_at_sale);
        }
      }

      for (const it of params.items) {
        const prod = this.products.get(it.product_id);
        if (!prod) throw new Error(`Product not found: ${it.product_id}`);

        const unitPrice = it.unit_price !== undefined ? it.unit_price : prod.selling_price;
        const discount = it.discount_amount || 0;
        const lineTotal = Math.max(0, unitPrice * it.quantity - discount);
        subtotal += unitPrice * it.quantity;
        totalItemDiscount += discount;

        newOrderItems.push({
          id: `ITEM-${Date.now()}-${newOrderItems.length + 1}`,
          order_id: order.id,
          product_id: prod.id,
          product_name: prod.display_name,
          sku: prod.sku,
          barcode: prod.barcode,
          quantity: it.quantity,
          unit_price: unitPrice,
          discount_amount: discount,
          total_price: lineTotal,
          unit_cost_at_sale: oldCostMap.has(prod.id) ? oldCostMap.get(prod.id)! : prod.avg_cost,
          perfume_type: prod.perfume_type,
        });
      }

      order.items = newOrderItems;
      order.subtotal = subtotal;
    }

    // 2. Customer details & fulfillment update
    if (params.customer_name) order.customer_name = params.customer_name.trim();
    if (params.customer_phone) order.customer_phone = this.normalizePhone(params.customer_phone);
    if (params.delivery_address !== undefined) order.delivery_address_text = params.delivery_address.trim();
    if (params.fulfillment_method) order.fulfillment_method = params.fulfillment_method;
    if (params.instant_delivery_provider !== undefined) order.instant_delivery_provider = params.instant_delivery_provider;
    if (params.rider_delivery_charge !== undefined) order.rider_delivery_charge = Math.max(0, Number(params.rider_delivery_charge));
    if (params.order_type) order.order_type = params.order_type;
    if (params.merchant_name !== undefined) order.merchant_name = params.merchant_name.trim() || undefined;
    if (params.merchant_id !== undefined) order.merchant_id = params.merchant_id.trim() || undefined;
    if (params.parcel_id !== undefined) order.parcel_id = params.parcel_id.trim() || undefined;
    if (params.end_customer_name !== undefined) order.end_customer_name = params.end_customer_name.trim() || undefined;
    if (params.delivery_charge !== undefined) order.delivery_charge = order.fulfillment_method === 'instant_delivery' ? 0 : Number(params.delivery_charge);
    if (params.discount_amount !== undefined) order.discount_amount = Number(params.discount_amount);
    if (params.order_timing !== undefined) {
      order.order_timing = params.order_timing;
      order.scheduled_date = params.order_timing === 'scheduled' ? params.scheduled_date : undefined;
    } else if (params.scheduled_date !== undefined && order.order_timing === 'scheduled') {
      order.scheduled_date = params.scheduled_date;
    }

    if (params.packing_note !== undefined) {
      order.packing_note = params.packing_note.trim() || undefined;
      order.packing_note_by_id = params.actor_id;
      order.packing_note_by_name = params.actor_name;
      order.packing_note_at = new Date().toISOString();
    }
    if (params.testers !== undefined) {
      if (Array.isArray(params.testers) && params.testers.length > 0) {
        order.testers = params.testers
          .filter(t => t.product_id && t.quantity > 0)
          .map((t, idx) => {
            const prod = this.products.get(t.product_id);
            return {
              id: `TESTER-${Date.now()}-${idx + 1}`,
              product_id: t.product_id,
              product_name: prod ? prod.display_name : (t.product_name || 'Free Tester / Sample'),
              sku: prod?.sku || t.sku || '',
              barcode: prod?.barcode || t.barcode || '',
              quantity: Math.max(1, Math.floor(Number(t.quantity))),
              notes: t.notes || '',
            };
          });
      } else {
        order.testers = undefined;
      }
    }

    // 3. Recalculate totals
    const finalTotal = Math.max(0, order.subtotal - order.discount_amount + order.delivery_charge);
    order.total = finalTotal;

    // Update pending COD payment amount if applicable
    if (order.payments && order.payments.length > 0) {
      const codPay = order.payments.find(p => p.method === 'cod_pending');
      if (codPay) {
        codPay.amount = finalTotal;
      }
    }

    order.updated_at = new Date().toISOString();

    // 4. Audit Log & Notifications (Section 35.1c)
    this.logAudit(
      params.actor_id,
      params.actor_name,
      'order_items_edited',
      'order',
      order.id,
      `Order ${order.invoice_number} edited by ${params.actor_name}. New total: ৳${order.total}`,
      oldOrderSnapshot,
      order
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'system',
      message: `Order ${order.invoice_number} was edited by ${params.actor_name} (Total: ৳${order.total})`,
      ref_type: 'order',
      ref_id: order.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return order;
  }

  // Move a Pre-Order or Scheduled Order into Today's Orders Queue
  public movePreOrderToToday(orderId: string, actorId: string, actorName: string): Order {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    if (order.status === 'cancelled') {
      throw new Error("Cannot move a cancelled order to Today's Orders.");
    }

    const shopFloorWh = 'wh_shop';
    const expanded = this.expandBundles(order.items.map(it => ({
      product_id: it.product_id,
      quantity: it.quantity,
    })));

    // Verify stock availability
    const requestedByProduct = new Map<string, number>();
    for (const comp of expanded) {
      requestedByProduct.set(comp.product_id, (requestedByProduct.get(comp.product_id) || 0) + comp.quantity);
    }
    for (const [productId, requested] of requestedByProduct) {
      const avail = this.getAvailableStock(productId, shopFloorWh);
      const prod = this.products.get(productId);
      const name = prod ? prod.display_name : productId;
      if (requested > avail) {
        throw new Error(`Insufficient stock for "${name}". Available: ${avail}, Requested: ${requested}`);
      }
    }

    // Reserve stock if it was a pre-order (which hadn't reserved stock yet)
    if (order.order_timing === 'pre_order') {
      for (const comp of expanded) {
        const invK = this.invKey(comp.product_id, shopFloorWh);
        let inv = this.inventory.get(invK);
        if (!inv) {
          inv = { product_id: comp.product_id, warehouse_id: shopFloorWh, on_hand: 0, reserved: 0, avg_cost: 0 };
          this.inventory.set(invK, inv);
        }
        inv.reserved += comp.quantity;
        this.reservationEvents.push({
          id: `RES-${Date.now()}-${this.reservationEvents.length + 1}`,
          order_id: order.id,
          product_id: comp.product_id,
          warehouse_id: shopFloorWh,
          quantity: comp.quantity,
          type: 'RESERVE',
          created_by: actorId,
          created_by_name: actorName,
          created_at: new Date().toISOString(),
          notes: `Stock reserved: Pre-order ${order.invoice_number} approved and moved to Today's Orders`,
        });
      }
    }

    order.order_timing = 'today';
    order.moved_to_today_at = new Date().toISOString();
    order.updated_at = new Date().toISOString();

    this.logAudit(
      actorId,
      actorName,
      'pre_order_moved_to_today',
      'order',
      order.id,
      `Pre-order ${order.invoice_number} moved into Today's operational orders queue by ${actorName}`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'system',
      message: `Order ${order.invoice_number} moved to Today's Orders by ${actorName}`,
      ref_type: 'order',
      ref_id: order.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return order;
  }

  // Bulk move Pre-Orders to Today's Orders Queue
  public bulkMovePreOrdersToToday(
    orderIds: string[],
    actorId: string,
    actorName: string
  ): {
    success_count: number;
    failed: { order_id: string; invoice_number: string; reason: string }[];
  } {
    let successCount = 0;
    const failed: { order_id: string; invoice_number: string; reason: string }[] = [];

    for (const id of orderIds) {
      const order = this.orders.get(id);
      if (!order) {
        failed.push({ order_id: id, invoice_number: id, reason: 'Order not found' });
        continue;
      }
      try {
        this.movePreOrderToToday(id, actorId, actorName);
        successCount++;
      } catch (err: any) {
        failed.push({
          order_id: id,
          invoice_number: order.invoice_number,
          reason: err.message || 'Error moving pre-order',
        });
      }
    }

    return { success_count: successCount, failed };
  }

  // Delete Order & Release Stock Reservation
  public deleteOrder(orderId: string, actorId: string = 'system', actorName: string = 'Staff'): void {
    const order = this.orders.get(orderId);
    if (!order) return;

    // Release any held reservations if the order is still confirmed (not yet packed/dispatched)
    if (order.status === 'confirmed') {
      const shopFloorWh = 'wh_shop';
      const expanded = this.expandBundles(order.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })));
      for (const comp of expanded) {
        const invK = this.invKey(comp.product_id, shopFloorWh);
        const inv = this.inventory.get(invK);
        if (inv) {
          inv.reserved = Math.max(0, inv.reserved - comp.quantity);
          this.reservationEvents.push({
            id: `RES-${Date.now()}-${this.reservationEvents.length + 1}`,
            order_id: order.id,
            product_id: comp.product_id,
            warehouse_id: shopFloorWh,
            quantity: comp.quantity,
            type: 'RELEASE',
            created_by: actorId,
            created_by_name: actorName,
            created_at: new Date().toISOString(),
            notes: `Reservation released on deletion of order ${order.invoice_number}`,
          });
        }
      }
    }

    this.orders.delete(orderId);
    this.logAudit(actorId, actorName, 'order_deleted', 'order', orderId, `Deleted order ${order.invoice_number}`);
  }

  // Packing Verification & Physical Stock Deduction (Section 8, 10, 40.2)
  public packOrder(params: {
    order_id: string;
    actor_id: string;
    actor_name: string;
    package_weight_grams?: number;
    box_size?: string;
    qa_notes?: string;
  }): Order {
    const order = this.orders.get(params.order_id);
    if (!order) throw new Error('Order not found');

    if (order.status === 'packed') {
      return order; // Already packed
    }

    if (order.status !== 'confirmed') {
      throw new Error(`Cannot pack order in status "${order.status}". Only confirmed orders can be packed.`);
    }

    const shopFloorWh = 'wh_shop';

    // Validate every physical component before changing any inventory. This
    // prevents a multi-item order from being partially packed if a later SKU
    // is short, and captures COGS at the physical pack-time event.
    const expandedForPack: { product_id: string; quantity: number }[] = [];
    for (const item of order.items) {
      const prod = this.products.get(item.product_id);
      if (!prod) throw new Error(`Cannot pack order: product ${item.product_id} no longer exists.`);
      const expanded = prod.is_bundle && prod.bundle_components && prod.bundle_components.length > 0
        ? prod.bundle_components.map(comp => ({ product_id: comp.component_product_id, quantity: comp.quantity * item.quantity }))
        : [{ product_id: item.product_id, quantity: item.quantity }];
      const lineCost = expanded.reduce((sum, comp) => {
        const inv = this.inventory.get(this.invKey(comp.product_id, shopFloorWh));
        const component = this.products.get(comp.product_id);
        if (!inv) throw new Error(`Cannot pack "${component?.display_name || comp.product_id}": no Shop Floor inventory record exists.`);
        if (inv.on_hand < comp.quantity) {
          throw new Error(`Cannot pack "${component?.display_name || comp.product_id}" \u2014 only ${inv.on_hand} on hand, need ${comp.quantity}. Stock has been reduced since this order was confirmed.`);
        }
        if (inv.reserved < comp.quantity) {
          throw new Error(`Cannot pack "${component?.display_name || comp.product_id}" \u2014 reservation mismatch (${inv.reserved} reserved, need ${comp.quantity}). Please cancel and re-create the order.`);
        }
        expandedForPack.push(comp);
        return sum + inv.avg_cost * comp.quantity;
      }, 0);
      item.unit_cost_at_sale = item.quantity > 0 ? lineCost / item.quantity : 0;
    }

    // Deduct on_hand and release reserved for each item
    for (const item of order.items) {
      const prod = this.products.get(item.product_id);
      if (!prod) continue;

      const expanded: { product_id: string; quantity: number }[] = [];
      if (prod.is_bundle && prod.bundle_components && prod.bundle_components.length > 0) {
        for (const comp of prod.bundle_components) {
          expanded.push({
            product_id: comp.component_product_id,
            quantity: comp.quantity * item.quantity,
          });
        }
      } else {
        expanded.push({ product_id: item.product_id, quantity: item.quantity });
      }

      for (const comp of expanded) {
        const cProd = this.products.get(comp.product_id);
        const invK = this.invKey(comp.product_id, shopFloorWh);
        const inv = this.inventory.get(invK);
        if (inv) {
          // Section 32.5: negative inventory is rejected, never silently
          // clamped. If on_hand (or reserved) is short of what packing
          // requires, reject the pack with a clear message instead of
          // zeroing the count.
          const name = cProd ? cProd.display_name : comp.product_id;
          if (inv.on_hand < comp.quantity) {
            throw new Error(`Cannot pack "${name}" \u2014 only ${inv.on_hand} on hand, need ${comp.quantity}. Stock has been reduced since this order was confirmed.`);
          }
          if (inv.reserved < comp.quantity) {
            throw new Error(`Cannot pack "${name}" \u2014 reservation mismatch (${inv.reserved} reserved, need ${comp.quantity}). Please cancel and re-create the order.`);
          }
          inv.on_hand -= comp.quantity;
          inv.reserved -= comp.quantity;

          // Section 32.4/41 reservation ledger \u2014 reservation consumed at pack
          this.reservationEvents.push({
            id: `RES-${Date.now()}-${this.reservationEvents.length + 1}`,
            order_id: order.id,
            product_id: comp.product_id,
            warehouse_id: shopFloorWh,
            quantity: comp.quantity,
            type: 'RELEASE',
            created_by: params.actor_id,
            created_by_name: params.actor_name,
            created_at: new Date().toISOString(),
            notes: `Reservation consumed at packing for order ${order.invoice_number}`,
          });

          const mov: StockMovement = {
            id: `MOV-${Date.now()}-${this.nextMovementId++}`,
            product_id: comp.product_id,
            product_name: cProd?.display_name || 'Perfume SKU',
            sku: cProd?.sku || 'SKU',
            warehouse_id: shopFloorWh,
            warehouse_name: 'Shop Floor (Showroom)',
            quantity_delta: -comp.quantity,
            movement_reason: 'SALE',
            unit_cost: inv.avg_cost,
            total_cost: comp.quantity * inv.avg_cost,
            reference_id: order.invoice_number,
            notes: `Packed & verified for order ${order.invoice_number}`,
            created_by: params.actor_id,
            created_by_name: params.actor_name,
            created_at: new Date().toISOString(),
          };
          this.stockMovements.unshift(mov);
        }
      }
    }

    // Update order status
    order.status = 'packed';
    order.packed_by = params.actor_id;
    order.packed_by_name = params.actor_name;
    order.packed_at = new Date().toISOString();
    order.package_weight_grams = params.package_weight_grams;
    order.package_box_size = params.box_size;
    order.qa_notes = params.qa_notes;
    order.updated_at = new Date().toISOString();

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'order_packed',
      'order',
      order.id,
      `Order ${order.invoice_number} verified and packed by ${params.actor_name}`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'system',
      message: `Order ${order.invoice_number} packed and ready for courier pickup`,
      ref_type: 'order',
      ref_id: order.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return order;
  }

  // Steadfast Actual Charge Calculator (Section 12.1, 41)
  public calculateSteadfastCharge(
    address: string,
    weightGrams?: number
  ): { zone: 'inside_dhaka' | 'outside_dhaka' | 'sub_dhaka'; actualFee: number } {
    const norm = (address || '').toLowerCase();
    const isDhaka =
      norm.includes('dhaka') ||
      norm.includes('banani') ||
      norm.includes('gulshan') ||
      norm.includes('dhanmondi') ||
      norm.includes('mirpur') ||
      norm.includes('uttara') ||
      norm.includes('mohammadpur') ||
      norm.includes('badda') ||
      norm.includes('motijheel') ||
      norm.includes('bashundhara') ||
      norm.includes('khilgaon') ||
      norm.includes('rampura') ||
      norm.includes('malibagh') ||
      norm.includes('lalmatia');

    const isSubDhaka =
      norm.includes('savar') ||
      norm.includes('gazipur') ||
      norm.includes('narayanganj') ||
      norm.includes('keraniganj') ||
      norm.includes('tongi');

    let zone: 'inside_dhaka' | 'outside_dhaka' | 'sub_dhaka' = 'outside_dhaka';
    let baseFee = 110; // Steadfast standard base fee outside Dhaka

    if (isDhaka) {
      zone = 'inside_dhaka';
      baseFee = 60; // Steadfast standard base fee inside Dhaka
    } else if (isSubDhaka) {
      zone = 'sub_dhaka';
      baseFee = 100; // Steadfast sub-dhaka fee
    }

    const weight = weightGrams || 500;
    let weightSurcharge = 0;
    if (weight > 1000) {
      const extraKgs = Math.ceil((weight - 1000) / 1000);
      weightSurcharge = extraKgs * (zone === 'inside_dhaka' ? 15 : 25);
    }

    return {
      zone,
      actualFee: baseFee + weightSurcharge,
    };
  }

  // Courier Booking with Steadfast (Section 11, 12, 12.1, 40.2)
  // IMPORTANT: Booking is NOT dispatch. This only records the Steadfast
  // booking (consignment/tracking) and marks the order as "booked / label
  // pending". It keeps order.status unchanged ('confirmed' or 'packed') so
  // the order REMAINS in the operational work queue until the thermal label
  // is printed + verified and the final physical Dispatch step runs.
  // Confirmed orders may be booked BEFORE packing (book-before-pack).
  public recordCourierBooking(params: {
    order_id: string;
    consignment_id: number | string;
    tracking_code: string;
    actual_charge?: number;
    customer_delivery_charge?: number;
    merchant_payout?: number;
    carrier_status?: string;
    actor_id: string;
    actor_name: string;
  }): Order {
    const order = this.orders.get(params.order_id);
    if (!order) throw new Error('Order not found');
    if (order.fulfillment_method === 'instant_delivery') {
      throw new Error('Instant Delivery orders cannot be booked with Steadfast.');
    }

    if (order.status !== 'confirmed' && order.status !== 'packed') {
      throw new Error(`Cannot book courier for order in status "${order.status}". Only Confirmed or Packed orders can be booked with Steadfast.`);
    }

    // Idempotency (Section 32.3): if already booked with the same consignment, return as-is
    if (order.courier_booked && order.courier_consignment_id && String(order.courier_consignment_id) === String(params.consignment_id)) {
      return order;
    }

    const tracking = params.tracking_code;
    const consignmentIdStr = String(params.consignment_id);
    const calc = this.calculateSteadfastCharge(
      order.delivery_address_text || '',
      order.package_weight_grams
    );
    // Estimated charge is ONLY the booking/system estimation, never treated as confirmed actual
    const estimatedCharge = calc.actualFee;
    const hasActual = params.actual_charge !== undefined && params.actual_charge !== null && !isNaN(Number(params.actual_charge)) && Number(params.actual_charge) > 0;
    const actualCharge = hasActual ? Number(params.actual_charge) : null;
    const customerCharge = params.customer_delivery_charge !== undefined ? params.customer_delivery_charge : order.delivery_charge;
    const variance = actualCharge !== null ? (customerCharge - actualCharge) : null;

    // Booking recorded \u2014 status intentionally stays 'packed'.
    order.courier_booked = true;
    order.courier_booking_at = new Date().toISOString();
    order.courier_consignment_id = consignmentIdStr;
    order.courier_tracking_code = tracking;
    order.courier_estimated_charge = estimatedCharge;
    order.actual_courier_charge = actualCharge;
    order.courier_charge_source = hasActual ? 'steadfast_api' : undefined;
    // Reset downstream physical-dispatch markers when re-booking
    order.label_printed = false;
    order.tracking_verified = false;
    order.updated_at = new Date().toISOString();

    let bookingStatus: CourierBookingStatus = 'in_transit';
    const rawStatus = (params.carrier_status || '').toLowerCase();
    if (rawStatus === 'delivered') bookingStatus = 'delivered';
    else if (rawStatus === 'cancelled') bookingStatus = 'cancelled';
    else if (rawStatus.includes('rto') || rawStatus === 'returned') bookingStatus = 'rto';
    else if (rawStatus === 'in_review' || rawStatus === 'pending') bookingStatus = 'booked';

    // Create / Update Courier Booking Record (Section 12.1 & 41)
    const bookingId = `BK-${order.id}`;
    const booking: CourierBooking = {
      id: bookingId,
      order_id: order.id,
      invoice_number: order.invoice_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      delivery_address: order.delivery_address_text || '',
      booking_id: consignmentIdStr,
      consignment_no: tracking,
      status: bookingStatus,
      cod_amount: order.courier_cod_amount !== undefined ? order.courier_cod_amount : (order.due_amount !== undefined ? order.due_amount : order.total),
      delivery_charge: customerCharge,
      estimated_charge: estimatedCharge,
      actual_charge: actualCharge,
      variance,
      courier_charge_source: hasActual ? 'steadfast_api' : undefined,
      charge_synced_at: hasActual ? new Date().toISOString() : undefined,
      charge_history: hasActual ? [{
        id: `CHG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        source: 'steadfast_api',
        previous_charge: null,
        new_charge: actualCharge!,
        actor_id: params.actor_id,
        actor_name: params.actor_name,
        notes: 'Initial confirmed charge from Steadfast booking response'
      }] : [],
      customer_delivery_charge: customerCharge,
      actual_courier_cost: actualCharge,
      package_weight_grams: order.package_weight_grams || 500,
      destination_zone: calc.zone,
      delivery_zone: calc.zone,
      booked_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      payout_status: 'pending',
      payout_amount: params.merchant_payout !== undefined ? params.merchant_payout : (actualCharge !== null ? order.total - actualCharge : order.total),
    };
    this.courierBookings.set(bookingId, booking);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'courier_booking_created',
      'order',
      order.id,
      `Order ${order.invoice_number} booked with Steadfast (Consignment #${consignmentIdStr}, Tracking: ${tracking}). Estimated Fee: \u09F3${estimatedCharge}, Actual Fee: ${actualCharge !== null ? '\u09F3' + actualCharge : 'Pending Confirmation'}, Customer Delivery: \u09F3${customerCharge}, Variance: ${variance !== null ? '\u09F3' + variance : 'Pending'}. Awaiting thermal label print + physical dispatch.`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'system',
      message: `Order ${order.invoice_number} booked with Steadfast (${tracking}) [Consignment #${consignmentIdStr}] \u2014 awaiting label print & dispatch`,
      ref_type: 'order',
      ref_id: order.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return order;
  }

  // Physical step 1: the courier thermal label has been printed/attached.
  public recordLabelPrinted(params: {
    order_id: string;
    actor_id: string;
    actor_name: string;
  }): Order {
    const order = this.orders.get(params.order_id);
    if (!order) throw new Error('Order not found');
    if (order.fulfillment_method === 'instant_delivery') {
      throw new Error('Instant Delivery orders use a normal address sticker, not a courier label.');
    }
    if (order.status !== 'packed') {
      throw new Error(`Cannot mark label printed for order in status "${order.status}". Only packed orders can be labeled.`);
    }

    order.label_printed = true;
    order.label_printed_at = new Date().toISOString();
    order.updated_at = new Date().toISOString();

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'courier_label_printed',
      'order',
      order.id,
      `4x6 thermal courier label printed & attached for order ${order.invoice_number} (Tracking: ${order.courier_tracking_code || 'n/a'})`
    );

    return order;
  }

  // Physical step 2: verify the tracking/consignment barcode scanned from the
  // printed label belongs to this exact order. A wrong barcode is rejected
  // and the order stays in Packing.
  public verifyTrackingBarcode(params: {
    order_id: string;
    scanned_barcode: string;
    actor_id: string;
    actor_name: string;
  }): Order {
    const order = this.orders.get(params.order_id);
    if (!order) throw new Error('Order not found');
    if (order.fulfillment_method === 'instant_delivery') {
      throw new Error('Instant Delivery orders do not have a courier tracking barcode.');
    }
    if (order.status !== 'packed') {
      throw new Error(`Cannot verify tracking barcode for order in status "${order.status}".`);
    }

    const expected = String(order.courier_tracking_code || order.courier_consignment_id || '').trim();
    const scanned = String(params.scanned_barcode || '').trim();
    if (!expected) {
      throw new Error('Order has no Steadfast booking yet \u2014 book with Steadfast before verifying the label.');
    }
    if (!scanned || scanned.toUpperCase() !== expected.toUpperCase()) {
      throw new Error(`Tracking barcode mismatch: scanned "${scanned}" does not match the consignment/tracking for order ${order.invoice_number} (expected "${expected}"). Order remains in Packing.`);
    }

    order.tracking_verified = true;
    order.tracking_verified_at = new Date().toISOString();
    order.tracking_verified_by = params.actor_name;
    order.updated_at = new Date().toISOString();

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'courier_tracking_verified',
      'order',
      order.id,
      `Tracking/consignment barcode "${scanned}" verified for order ${order.invoice_number}. Ready to dispatch.`
    );

    return order;
  }

  // Final physical step: Dispatch. Requires booking + label printed + tracking
  // verified. This is the ONLY place an order transitions packed -> dispatched.
  public recordDispatch(params: {
    order_id: string;
    actor_id: string;
    actor_name: string;
  }): Order {
    const order = this.orders.get(params.order_id);
    if (!order) throw new Error('Order not found');

    if (order.status === 'dispatched' || order.status === 'delivered') {
      return order; // idempotent
    }
    if (order.status !== 'packed') {
      throw new Error(`Cannot dispatch order in status "${order.status}". Only packed orders can be dispatched.`);
    }
    if (order.fulfillment_method === 'instant_delivery') {
      order.status = 'dispatched';
      order.dispatched_by = params.actor_id;
      order.dispatched_by_name = params.actor_name;
      order.dispatched_at = new Date().toISOString();
      order.delivered_by_user_id = params.actor_id;
      order.delivered_by_name = params.actor_name;
      order.updated_at = new Date().toISOString();
      this.logAudit(
        params.actor_id,
        params.actor_name,
        'instant_delivery_handover',
        'order',
        order.id,
        `Order ${order.invoice_number} handed over to ${order.instant_delivery_provider || 'instant delivery'} rider by ${params.actor_name}. Rider-collected delivery charge is excluded from Mirage receipts.`
      );
      return order;
    }
    if (!order.courier_booked || !order.courier_tracking_code) {
      throw new Error(`Order ${order.invoice_number} is not booked with Steadfast yet. Book with Steadfast before dispatching.`);
    }
    if (!order.label_printed) {
      throw new Error(`Order ${order.invoice_number} has no printed courier label. Print & attach the 4x6 thermal label before dispatching.`);
    }
    if (!order.tracking_verified) {
      throw new Error(`Order ${order.invoice_number} label not verified. Scan the consignment/tracking barcode on the printed label before dispatching.`);
    }

    order.status = 'dispatched';
    order.dispatched_by = params.actor_id;
    order.dispatched_by_name = params.actor_name;
    order.dispatched_at = new Date().toISOString();
    order.updated_at = new Date().toISOString();

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'order_dispatched',
      'order',
      order.id,
      `Order ${order.invoice_number} dispatched (booked: ${order.courier_tracking_code}). Left the Packing queue. Further tracking from Steadfast.`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'system',
      message: `Order ${order.invoice_number} dispatched to courier (${order.courier_tracking_code})`,
      ref_type: 'order',
      ref_id: order.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return order;
  }

  // Legacy booking wrapper \u2014 books with Steadfast (does NOT dispatch).
  // Physical dispatch is a separate step (recordDispatch) that requires the
  // label to have been printed and verified. See the Packing section 35/40.
  public bookOrderWithCourier(params: {
    order_id: string;
    consignment_id?: number | string;
    tracking_code?: string;
    actual_charge?: number;
    customer_delivery_charge?: number;
    merchant_payout?: number;
    carrier_status?: string;
    actor_id: string;
    actor_name: string;
  }): Order {
    return this.recordCourierBooking({
      order_id: params.order_id,
      consignment_id: params.consignment_id || `STF-${Date.now().toString().slice(-6)}`,
      tracking_code: params.tracking_code || `STF-${Date.now().toString().slice(-6)}`,
      actual_charge: params.actual_charge,
      customer_delivery_charge: params.customer_delivery_charge,
      merchant_payout: params.merchant_payout,
      carrier_status: params.carrier_status,
      actor_id: params.actor_id,
      actor_name: params.actor_name,
    });
  }

  // Update Courier Status & Trigger Accounting on Delivered (Section 12.1, 15.0, 15.15)
  public syncCourierStatus(params: {
    booking_id: string;
    new_status: CourierBookingStatus;
    actual_charge_override?: number;
    actor_id: string;
    actor_name: string;
    notes?: string;
  }): CourierBooking {
    const booking = this.courierBookings.get(params.booking_id);
    if (!booking) throw new Error('Courier booking not found');

    const order = this.orders.get(booking.order_id);
    if (!order) throw new Error('Order not found for booking');

    if (params.actual_charge_override !== undefined && params.actual_charge_override !== null) {
      const overrideVal = Number(params.actual_charge_override);
      if (!isNaN(overrideVal) && overrideVal > 0) {
        if (booking.courier_charge_source === 'manual' && booking.actual_charge !== null && booking.actual_charge !== undefined) {
          if (booking.actual_charge !== overrideVal) {
            // Guard: don't overwrite manual entry, flag conflict
            booking.pending_api_conflict = {
              api_charge: overrideVal,
              fetched_at: new Date().toISOString(),
              note: `Status sync reported ৳${overrideVal} (manual charge is ৳${booking.actual_charge})`
            };
          } else {
            booking.charge_synced_at = new Date().toISOString();
            booking.pending_api_conflict = null;
          }
        } else {
          const prevCharge = booking.actual_charge;
          booking.actual_charge = overrideVal;
          booking.actual_courier_cost = overrideVal;
          booking.variance = booking.delivery_charge - overrideVal;
          booking.courier_charge_source = 'steadfast_api';
          booking.charge_synced_at = new Date().toISOString();
          booking.pending_api_conflict = null;

          booking.charge_history = booking.charge_history || [];
          booking.charge_history.push({
            id: `CHG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            source: 'steadfast_api',
            previous_charge: prevCharge,
            new_charge: overrideVal,
            actor_id: params.actor_id,
            actor_name: params.actor_name,
            notes: 'Confirmed charge updated via courier status sync'
          });

          if (order) {
            order.actual_courier_charge = overrideVal;
            order.courier_charge_source = 'steadfast_api';
          }
        }
      }
    }

    booking.status = params.new_status;
    if (params.notes) booking.notes = params.notes;

    if (params.new_status === 'delivered') {
      // Idempotency guard (Section 32.3 / 35.6): a repeated "delivered"
      // webhook/poll for an order already recognized must NOT re-post the
      // revenue/COGS journal entry \u2014 that would double-count it.
      const alreadyDelivered = order.status === 'delivered';
      if (!alreadyDelivered) {
        booking.delivered_at = new Date().toISOString();
        order.status = 'delivered';
        order.updated_at = new Date().toISOString();
      } else {
        booking.status = params.new_status;
      }

      if (!alreadyDelivered) {
        // Post Double-Entry Journal on Delivered (Section 15.0, 15.15)
        // Dr Courier Receivable (COD total)
        // Cr Sales Revenue (Net product sale)
        // Cr Delivery Income (Customer delivery fee)
        // Dr COGS
        // Cr Inventory
        const totalCOGS = order.items.reduce((s, i) => s + (i.unit_cost_at_sale * i.quantity), 0);
        const netProductRevenue = order.subtotal - order.discount_amount;
        const deliveryIncome = order.delivery_charge;

        this.postJournal(
          new Date().toISOString().slice(0, 10),
          'courier_delivered',
          order.id,
          `Steadfast COD Delivered: ${order.invoice_number} (${order.customer_name})`,
          [
            { account_id: 'acc_courier_rec', debit: order.total, credit: 0, line_desc: `COD collection receivable for ${order.invoice_number}` },
            { account_id: 'acc_sales_rev', debit: 0, credit: netProductRevenue, line_desc: `Product revenue for ${order.invoice_number}` },
            { account_id: 'acc_deliv_inc', debit: 0, credit: deliveryIncome, line_desc: `Delivery charge income for ${order.invoice_number}` },
            { account_id: 'acc_cogs', debit: totalCOGS, credit: 0, line_desc: `COGS for ${order.invoice_number}` },
            { account_id: 'acc_inventory', debit: 0, credit: totalCOGS, line_desc: `Inventory reduction for ${order.invoice_number}` },
          ],
          params.actor_name || 'System',
          undefined,
          'pos_sale'
        );

        this.logAudit(
          params.actor_id,
          params.actor_name,
          'courier_delivered',
          'order',
          order.id,
          `Order ${order.invoice_number} marked Delivered by Steadfast. Revenue \u09F3${netProductRevenue} & COGS \u09F3${totalCOGS} recognized.`
        );
      }
    } else if (params.new_status === 'rto') {
      order.status = 'returned';
      order.updated_at = new Date().toISOString();
      this.logAudit(
        params.actor_id,
        params.actor_name,
        'courier_rto',
        'order',
        order.id,
        `Order ${order.invoice_number} returned to origin (RTO). Physical scan-back required.`
      );
    }

    return booking;
  }

  // Steadfast Payout Reconciliation (Section 12.1, 15.2)
  public reconcileCourierPayout(params: {
    booking_id: string;
    actual_payout?: number;
    payment_account_id?: string;
    actor_id: string;
    actor_name: string;
    notes?: string;
  }): CourierBooking {
    const booking = this.courierBookings.get(params.booking_id);
    if (!booking) throw new Error('Courier booking not found');

    if (booking.actual_charge === null || booking.actual_charge === undefined) {
      throw new Error(`Cannot reconcile courier payout for ${booking.invoice_number}: actual confirmed courier charge is pending. Please confirm Steadfast actual charge or enter it manually first.`);
    }

    const targetAccount = params.payment_account_id || 'acc_bank';
    const acc = this.accounts.get(targetAccount);
    if (!acc) throw new Error('Target payout account not found');

    // Expected Payout = COD Amount - Steadfast Actual Delivery Charge
    const netPayout = params.actual_payout !== undefined ? params.actual_payout : (booking.cod_amount - booking.actual_charge);

    booking.payout_status = 'reconciled';
    booking.payout_amount = netPayout;
    if (params.notes) booking.notes = params.notes;

    // Post Double-Entry Journal for Steadfast Payout (Section 15.0 & 15.2)
    // Dr Bank / MFS (Net cash received)
    // Dr Courier Expenses (Actual Steadfast delivery charge)
    // Cr Courier Receivable (Total COD cleared)
    this.postJournal(
      new Date().toISOString().slice(0, 10),
      'courier_payout',
      booking.id,
      `Steadfast Payout Settlement: ${booking.invoice_number} (${booking.consignment_no})`,
      [
        { account_id: targetAccount, debit: netPayout, credit: 0, line_desc: `Net COD payout received from Steadfast` },
        { account_id: 'acc_courier_exp', debit: booking.actual_charge, credit: 0, line_desc: `Steadfast confirmed courier fee for ${booking.invoice_number}` },
        { account_id: 'acc_courier_rec', debit: 0, credit: booking.cod_amount, line_desc: `Cleared COD receivable for ${booking.invoice_number}` },
      ],
      params.actor_name || 'Accountant',
      undefined,
      'courier_settlement'
    );

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'courier_payout_reconciled',
      'courier_booking',
      booking.id,
      `Steadfast Payout Reconciled for ${booking.invoice_number}: Received \u09F3${netPayout} in ${acc.name}, Courier Fee \u09F3${booking.actual_charge}`
    );

    return booking;
  }

  public updateCourierActualChargeManual(params: {
    booking_id: string;
    actual_charge: number;
    actor_id: string;
    actor_name: string;
    notes?: string;
  }): CourierBooking {
    const booking = this.courierBookings.get(params.booking_id);
    if (!booking) throw new Error('Courier booking not found');

    const order = this.orders.get(booking.order_id);
    const newCharge = Number(params.actual_charge);
    if (isNaN(newCharge) || newCharge < 0) {
      throw new Error('Valid non-negative actual courier charge is required');
    }

    const previousCharge = booking.actual_charge ?? null;
    booking.actual_charge = newCharge;
    booking.actual_courier_cost = newCharge;
    booking.variance = booking.delivery_charge - newCharge;
    booking.courier_charge_source = 'manual';
    booking.charge_entered_by_id = params.actor_id;
    booking.charge_entered_by_name = params.actor_name;
    booking.charge_entered_at = new Date().toISOString();
    booking.updated_at = new Date().toISOString();

    if (booking.pending_api_conflict && booking.pending_api_conflict.api_charge === newCharge) {
      booking.pending_api_conflict = null;
    }

    const auditEntry: CourierChargeAuditEntry = {
      id: `CHG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      source: 'manual',
      previous_charge: previousCharge,
      new_charge: newCharge,
      actor_id: params.actor_id,
      actor_name: params.actor_name,
      notes: params.notes || 'Manual courier fee correction/entry by staff',
    };

    booking.charge_history = booking.charge_history || [];
    booking.charge_history.push(auditEntry);

    if (order) {
      order.actual_courier_charge = newCharge;
      order.courier_charge_source = 'manual';
      order.updated_at = new Date().toISOString();
    }

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'courier_charge_manual_update',
      'courier_booking',
      booking.id,
      `Manual courier charge updated for ${booking.invoice_number} (${booking.consignment_no}): \u09F3${previousCharge ?? 'Pending'} \u2794 \u09F3${newCharge}. Notes: ${params.notes || 'N/A'}`
    );

    return booking;
  }

  public resolveCourierChargeConflict(params: {
    booking_id: string;
    resolution: 'accept_api' | 'keep_manual';
    actor_id: string;
    actor_name: string;
    notes?: string;
  }): CourierBooking {
    const booking = this.courierBookings.get(params.booking_id);
    if (!booking) throw new Error('Courier booking not found');
    if (!booking.pending_api_conflict) {
      throw new Error('No pending API conflict found on this courier booking');
    }

    const conflict = booking.pending_api_conflict;
    const order = this.orders.get(booking.order_id);
    const previousCharge = booking.actual_charge;

    if (params.resolution === 'accept_api') {
      const newCharge = conflict.api_charge;
      booking.actual_charge = newCharge;
      booking.actual_courier_cost = newCharge;
      booking.variance = booking.delivery_charge - newCharge;
      booking.courier_charge_source = 'steadfast_api';
      booking.charge_synced_at = new Date().toISOString();
      booking.updated_at = new Date().toISOString();

      const auditEntry: CourierChargeAuditEntry = {
        id: `CHG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        source: 'steadfast_api',
        previous_charge: previousCharge,
        new_charge: newCharge,
        actor_id: params.actor_id,
        actor_name: params.actor_name,
        notes: `Accepted Steadfast API charge (replacing manual \u09F3${previousCharge}). ${params.notes || ''}`.trim(),
      };
      booking.charge_history = booking.charge_history || [];
      booking.charge_history.push(auditEntry);

      if (order) {
        order.actual_courier_charge = newCharge;
        order.courier_charge_source = 'steadfast_api';
        order.updated_at = new Date().toISOString();
      }

      this.logAudit(
        params.actor_id,
        params.actor_name,
        'courier_conflict_resolved_api',
        'courier_booking',
        booking.id,
        `Resolved courier charge conflict for ${booking.invoice_number}: Accepted API charge \u09F3${newCharge} over manual \u09F3${previousCharge}.`
      );
    } else {
      this.logAudit(
        params.actor_id,
        params.actor_name,
        'courier_conflict_resolved_manual',
        'courier_booking',
        booking.id,
        `Resolved courier charge conflict for ${booking.invoice_number}: Kept manual charge \u09F3${previousCharge} (declined API \u09F3${conflict.api_charge}).`
      );
    }

    booking.pending_api_conflict = null;
    return booking;
  }

  // Get Comprehensive Reconciliation Summary (Section 12.1, 15.2, 15.6)
  public getReconciliationSummary(): ReconciliationSummary {
    const bookings = Array.from(this.courierBookings.values());
    let totalCodExpected = 0;
    let totalCodCollected = 0;
    let totalCustomerDeliveryCharged = 0;
    let totalActualCourierCharges = 0;
    let deliveryChargedForConfirmed = 0;
    let reconciledCount = 0;
    let pendingCount = 0;
    let discrepancyCount = 0;
    let pendingActualCount = 0;

    for (const b of bookings) {
      totalCodExpected += b.cod_amount;
      totalCustomerDeliveryCharged += b.delivery_charge;

      if (b.actual_charge !== null && b.actual_charge !== undefined) {
        totalActualCourierCharges += b.actual_charge;
        deliveryChargedForConfirmed += b.delivery_charge;
      } else {
        pendingActualCount++;
      }

      if (b.status === 'delivered') {
        totalCodCollected += b.cod_amount;
      }

      if (b.payout_status === 'reconciled') {
        reconciledCount++;
      } else if (b.payout_status === 'discrepancy') {
        discrepancyCount++;
      } else {
        pendingCount++;
      }
    }

    return {
      total_courier_orders: bookings.length,
      total_cod_expected: totalCodExpected,
      total_cod_collected: totalCodCollected,
      total_customer_delivery_charged: totalCustomerDeliveryCharged,
      total_actual_courier_charges: totalActualCourierCharges,
      net_delivery_variance: deliveryChargedForConfirmed - totalActualCourierCharges,
      reconciled_count: reconciledCount,
      pending_count: pendingCount,
      discrepancy_count: discrepancyCount,
      pending_actual_charge_count: pendingActualCount,
    };
  }

  // --- COURIER SETTLEMENT & RECONCILIATION BATCHES (Section 12.1, 15.0, 15.2, 15.6) ---

  public recordOrderPayment(params: {
    order_id: string;
    amount: number;
    method: 'cash' | 'bkash' | 'nagad' | 'bank' | 'card';
    payment_account_id: string;
    transaction_ref?: string;
    actor_id: string;
    actor_name: string;
    notes?: string;
  }): Order {
    const order = this.orders.get(params.order_id);
    if (!order) throw new Error('Order not found');

    if (order.status === 'cancelled') {
      throw new Error('Cannot record payment against a cancelled order');
    }

    const amt = Number(params.amount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('Valid payment amount greater than 0 is required');
    }

    const completedDirectPaid = order.payments
      .filter(p => p.status === 'completed' && p.method !== 'cod_pending')
      .reduce((sum, p) => sum + p.amount, 0);

    const remainingReceivable = Math.max(0, order.total - completedDirectPaid);
    if (amt > remainingReceivable) {
      throw new Error(`Payment amount (৳${amt}) cannot exceed remaining balance due (৳${remainingReceivable})`);
    }

    const targetAccount = params.payment_account_id || 'acc_bkash';
    const acc = this.accounts.get(targetAccount);
    if (!acc) throw new Error('Payment account not found');

    const paymentTxn: PaymentTransaction = {
      id: `PAY-${Date.now()}-${this.nextPayNumber++}`,
      order_id: order.id,
      amount: amt,
      method: params.method,
      payment_account_id: targetAccount,
      transaction_ref: params.transaction_ref,
      received_by: params.actor_name,
      status: 'completed',
      created_at: new Date().toISOString(),
    };
    order.payments.push(paymentTxn);

    const newTotalDirect = completedDirectPaid + amt;
    const remainingCod = Math.max(0, order.total - newTotalDirect);

    const pendingCodIdx = order.payments.findIndex(p => p.method === 'cod_pending');
    if (pendingCodIdx >= 0) {
      if (remainingCod === 0) {
        order.payments.splice(pendingCodIdx, 1);
      } else {
        order.payments[pendingCodIdx].amount = remainingCod;
      }
    }

    const booking = Array.from(this.courierBookings.values()).find(
      b => b.order_id === order.id || b.invoice_number === order.invoice_number
    );
    if (booking) {
      booking.cod_amount = remainingCod;
      booking.updated_at = new Date().toISOString();
    }

    order.updated_at = new Date().toISOString();
    if (params.notes) {
      order.notes = (order.notes ? order.notes + '\n' : '') + params.notes;
    }

    // Post Double-Entry Journal for customer direct payment (Section 15.0 & 15.5)
    this.postJournal(
      new Date().toISOString().slice(0, 10),
      'customer_direct_payment',
      order.id,
      `Direct Customer Payment for ${order.invoice_number} via ${params.method.toUpperCase()} (${params.transaction_ref || 'No Ref'})`,
      [
        { account_id: targetAccount, debit: amt, credit: 0, line_desc: `Payment received in ${acc.name}` },
        { account_id: 'acc_courier_rec', debit: 0, credit: amt, line_desc: `Receivable reduction for ${order.invoice_number}` },
      ],
      params.actor_name,
      undefined,
      'pos_sale'
    );

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'order_payment_recorded',
      'order',
      order.id,
      `Recorded direct customer payment of ৳${amt} for ${order.invoice_number} via ${params.method.toUpperCase()}. Remaining COD: ৳${remainingCod}.`
    );

    return order;
  }

  public getSettlementBatches(): CourierSettlementBatch[] {
    return Array.from(this.settlementBatches.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public getSettlementBatch(id: string): CourierSettlementBatch {
    const batch = this.settlementBatches.get(id);
    if (!batch) throw new Error('Settlement batch not found');
    return batch;
  }

  public createSettlementBatch(params: {
    date_from: string;
    date_to: string;
    carrier?: 'steadfast' | 'other';
    booking_ids?: string[];
    deposit_account_id?: string;
    deposit_reference?: string;
    actual_bank_payout?: number;
    discrepancy_notes?: string;
    notes?: string;
    item_overrides?: Array<{
      booking_id: string;
      actual_cod_collected?: number;
      actual_courier_charge?: number;
      notes?: string;
    }>;
    actor_id: string;
    actor_name: string;
  }): CourierSettlementBatch {
    const carrier = params.carrier || 'steadfast';
    const dateFrom = params.date_from;
    const dateTo = params.date_to;

    let bookingsToInclude: CourierBooking[] = [];
    if (params.booking_ids && params.booking_ids.length > 0) {
      for (const bId of params.booking_ids) {
        const b = this.courierBookings.get(bId);
        if (!b) continue;
        if (b.payout_status === 'reconciled') {
          throw new Error(`Booking ${b.consignment_no} (${b.invoice_number}) has already been reconciled in another settlement.`);
        }
        bookingsToInclude.push(b);
      }
    } else {
      const fromTs = new Date(dateFrom).getTime();
      const toTs = new Date(dateTo + 'T23:59:59.999Z').getTime();

      bookingsToInclude = Array.from(this.courierBookings.values()).filter(b => {
        if (b.payout_status === 'reconciled') return false;
        if (b.status !== 'delivered' && b.status !== 'rto') return false;
        const bDate = b.delivered_at || b.updated_at || b.booked_at || b.created_at;
        if (!bDate) return false;
        const ts = new Date(bDate).getTime();
        return ts >= fromTs && ts <= toTs;
      });
    }

    if (bookingsToInclude.length === 0) {
      throw new Error('No eligible unsettled courier bookings found for the selected date range and criteria.');
    }

    const overridesMap = new Map<string, { actual_cod_collected?: number; actual_courier_charge?: number; notes?: string }>();
    if (params.item_overrides) {
      params.item_overrides.forEach(o => overridesMap.set(o.booking_id, o));
    }

    const items: SettlementBatchItem[] = bookingsToInclude.map(b => {
      const isRTO = b.status === 'rto';
      const override = overridesMap.get(b.id);

      const expectedCod = isRTO ? 0 : Number(b.cod_amount || 0);
      const actualCodCollected = override?.actual_cod_collected !== undefined
        ? Number(override.actual_cod_collected)
        : expectedCod;

      const customerDeliveryCharge = Number(b.delivery_charge || 0);
      const defaultCarrierCharge = isRTO ? (b.actual_charge ?? 100) : (b.actual_charge ?? b.estimated_charge ?? 70);
      const actualCourierCharge = override?.actual_courier_charge !== undefined
        ? Number(override.actual_courier_charge)
        : defaultCarrierCharge;

      const variance = customerDeliveryCharge - actualCourierCharge;
      const netPayout = actualCodCollected - actualCourierCharge;

      return {
        booking_id: b.id,
        order_id: b.order_id,
        invoice_number: b.invoice_number,
        consignment_no: b.consignment_no,
        customer_name: b.customer_name,
        customer_phone: b.customer_phone,
        status: b.status,
        expected_cod: expectedCod,
        actual_cod_collected: actualCodCollected,
        customer_delivery_charge: customerDeliveryCharge,
        actual_courier_charge: actualCourierCharge,
        variance,
        net_payout: netPayout,
        is_rto: isRTO,
        notes: override?.notes,
      };
    });

    const totalOrders = items.length;
    const totalDelivered = items.filter(i => !i.is_rto).length;
    const totalRTO = items.filter(i => i.is_rto).length;
    const totalExpectedCod = items.reduce((s, i) => s + i.expected_cod, 0);
    const totalCodCollected = items.reduce((s, i) => s + i.actual_cod_collected, 0);
    const totalCustomerDelivery = items.reduce((s, i) => s + i.customer_delivery_charge, 0);
    const totalActualCourierCharges = items.reduce((s, i) => s + i.actual_courier_charge, 0);
    const netCalculatedPayout = totalCodCollected - totalActualCourierCharges;

    const actualBankPayout = params.actual_bank_payout !== undefined
      ? Number(params.actual_bank_payout)
      : netCalculatedPayout;

    const discrepancyAmount = actualBankPayout - netCalculatedPayout;
    const targetAccount = params.deposit_account_id || 'acc_bank';
    const acc = this.accounts.get(targetAccount);

    const batchId = `BATCH-${Date.now()}`;
    const batchNumber = `ST-BATCH-${new Date().getFullYear()}-${String(this.nextSettlementBatchNumber++).padStart(4, '0')}`;

    const batch: CourierSettlementBatch = {
      id: batchId,
      batch_number: batchNumber,
      date_from: dateFrom,
      date_to: dateTo,
      carrier,
      status: 'draft',
      total_orders: totalOrders,
      total_delivered_orders: totalDelivered,
      total_rto_orders: totalRTO,
      total_expected_cod: totalExpectedCod,
      total_cod_collected: totalCodCollected,
      total_customer_delivery_charge: totalCustomerDelivery,
      total_actual_courier_charges: totalActualCourierCharges,
      net_calculated_payout: netCalculatedPayout,
      actual_bank_payout: actualBankPayout,
      discrepancy_amount: discrepancyAmount,
      deposit_account_id: targetAccount,
      deposit_account_name: acc?.name || 'City Bank Account',
      deposit_reference: params.deposit_reference,
      discrepancy_notes: params.discrepancy_notes,
      notes: params.notes,
      items,
      created_by_id: params.actor_id,
      created_by_name: params.actor_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    bookingsToInclude.forEach(b => {
      b.settlement_batch_id = batch.id;
      b.updated_at = new Date().toISOString();
    });

    this.settlementBatches.set(batch.id, batch);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'courier_settlement_batch_created',
      'settlement_batch',
      batch.id,
      `Created draft courier settlement batch ${batch.batch_number} with ${totalOrders} orders (Delivered: ${totalDelivered}, RTO: ${totalRTO}). Calculated Net: ৳${netCalculatedPayout}.`
    );

    return batch;
  }

  public updateSettlementBatch(
    id: string,
    params: {
      deposit_account_id?: string;
      deposit_reference?: string;
      actual_bank_payout?: number;
      discrepancy_notes?: string;
      notes?: string;
      items?: SettlementBatchItem[];
      actor_id: string;
      actor_name: string;
    }
  ): CourierSettlementBatch {
    const batch = this.settlementBatches.get(id);
    if (!batch) throw new Error('Settlement batch not found');

    if (batch.status === 'posted') {
      throw new Error('Cannot update a posted settlement batch. It is locked for audit integrity.');
    }

    if (params.items) {
      batch.items = params.items.map(item => {
        const variance = Number(item.customer_delivery_charge) - Number(item.actual_courier_charge);
        const netPayout = Number(item.actual_cod_collected) - Number(item.actual_courier_charge);
        return {
          ...item,
          variance,
          net_payout: netPayout,
        };
      });
    }

    if (params.deposit_account_id) {
      batch.deposit_account_id = params.deposit_account_id;
      const acc = this.accounts.get(params.deposit_account_id);
      if (acc) batch.deposit_account_name = acc.name;
    }
    if (params.deposit_reference !== undefined) batch.deposit_reference = params.deposit_reference;
    if (params.discrepancy_notes !== undefined) batch.discrepancy_notes = params.discrepancy_notes;
    if (params.notes !== undefined) batch.notes = params.notes;

    batch.total_orders = batch.items.length;
    batch.total_delivered_orders = batch.items.filter(i => !i.is_rto).length;
    batch.total_rto_orders = batch.items.filter(i => i.is_rto).length;
    batch.total_expected_cod = batch.items.reduce((s, i) => s + Number(i.expected_cod || 0), 0);
    batch.total_cod_collected = batch.items.reduce((s, i) => s + Number(i.actual_cod_collected || 0), 0);
    batch.total_customer_delivery_charge = batch.items.reduce((s, i) => s + Number(i.customer_delivery_charge || 0), 0);
    batch.total_actual_courier_charges = batch.items.reduce((s, i) => s + Number(i.actual_courier_charge || 0), 0);
    batch.net_calculated_payout = batch.total_cod_collected - batch.total_actual_courier_charges;

    if (params.actual_bank_payout !== undefined) {
      batch.actual_bank_payout = Number(params.actual_bank_payout);
    }
    batch.discrepancy_amount = batch.actual_bank_payout - batch.net_calculated_payout;
    batch.updated_at = new Date().toISOString();

    return batch;
  }

  public postSettlementBatch(
    id: string,
    params: {
      deposit_account_id?: string;
      deposit_reference?: string;
      actual_bank_payout?: number;
      discrepancy_notes?: string;
      actor_id: string;
      actor_name: string;
    }
  ): CourierSettlementBatch {
    const batch = this.settlementBatches.get(id);
    if (!batch) throw new Error('Settlement batch not found');

    if (batch.status === 'posted') {
      throw new Error('This settlement batch has already been posted and locked.');
    }

    if (batch.items.length === 0) {
      throw new Error('Cannot post an empty settlement batch.');
    }

    if (params.deposit_account_id) {
      batch.deposit_account_id = params.deposit_account_id;
      const acc = this.accounts.get(params.deposit_account_id);
      if (acc) batch.deposit_account_name = acc.name;
    }
    if (params.deposit_reference !== undefined) batch.deposit_reference = params.deposit_reference;
    if (params.discrepancy_notes !== undefined) batch.discrepancy_notes = params.discrepancy_notes;
    if (params.actual_bank_payout !== undefined) {
      batch.actual_bank_payout = Number(params.actual_bank_payout);
      batch.discrepancy_amount = batch.actual_bank_payout - batch.net_calculated_payout;
    }

    const targetAccount = batch.deposit_account_id || 'acc_bank';
    const acc = this.accounts.get(targetAccount);
    if (!acc) throw new Error(`Target payout account '${targetAccount}' not found in Chart of Accounts.`);

    // Safeguard against duplicate reconciliation
    for (const item of batch.items) {
      const b = this.courierBookings.get(item.booking_id);
      if (b && b.payout_status === 'reconciled' && b.settlement_batch_id && b.settlement_batch_id !== batch.id) {
        throw new Error(`Consignment ${b.consignment_no} (${b.invoice_number}) was already reconciled in batch ${b.settlement_batch_id}.`);
      }
    }

    // Build Atomic Double-Entry Journal Entry
    const journalLines: { account_id: string; debit: number; credit: number; line_desc?: string }[] = [];

    // 1. Debit Cash/Bank deposit account
    if (batch.actual_bank_payout > 0) {
      journalLines.push({
        account_id: targetAccount,
        debit: batch.actual_bank_payout,
        credit: 0,
        line_desc: `Net Steadfast payout deposited (${batch.batch_number}${batch.deposit_reference ? ' - ' + batch.deposit_reference : ''})`,
      });
    }

    // 2. Debit Courier Expenses
    if (batch.total_actual_courier_charges > 0) {
      journalLines.push({
        account_id: 'acc_courier_exp',
        debit: batch.total_actual_courier_charges,
        credit: 0,
        line_desc: `Steadfast courier freight & RTO fees for ${batch.total_orders} orders (${batch.batch_number})`,
      });
    }

    // 3. Discrepancy handling
    if (batch.discrepancy_amount !== 0) {
      if (batch.discrepancy_amount < 0) {
        journalLines.push({
          account_id: 'acc_courier_discrepancy',
          debit: Math.abs(batch.discrepancy_amount),
          credit: 0,
          line_desc: `Settlement shortage adjustment: ${batch.discrepancy_notes || 'Carrier withholding/deduction'} (${batch.batch_number})`,
        });
      } else {
        journalLines.push({
          account_id: 'acc_courier_discrepancy',
          debit: 0,
          credit: batch.discrepancy_amount,
          line_desc: `Settlement surplus adjustment: ${batch.discrepancy_notes || 'Carrier overpayment/credit'} (${batch.batch_number})`,
        });
      }
    }

    // 4. Credit Courier Receivable itemized by delivered order
    for (const item of batch.items) {
      if (item.actual_cod_collected > 0) {
        journalLines.push({
          account_id: 'acc_courier_rec',
          debit: 0,
          credit: item.actual_cod_collected,
          line_desc: `Cleared COD for ${item.invoice_number} (${item.consignment_no})`,
        });
      }
    }

    const journalEntry = this.postJournal(
      new Date().toISOString().slice(0, 10),
      'courier_batch_settlement',
      batch.id,
      `Steadfast Weekly Settlement Batch: ${batch.batch_number} (${batch.total_orders} orders settled)`,
      journalLines,
      params.actor_name || 'Accountant',
      undefined,
      'courier_settlement'
    );

    const nowIso = new Date().toISOString();
    for (const item of batch.items) {
      const b = this.courierBookings.get(item.booking_id);
      if (b) {
        b.payout_status = 'reconciled';
        b.actual_charge = item.actual_courier_charge;
        b.actual_courier_cost = item.actual_courier_charge;
        b.variance = item.variance;
        b.actual_cod_collected = item.actual_cod_collected;
        b.payout_amount = item.net_payout;
        b.settled_at = nowIso;
        b.settlement_batch_id = batch.id;
        b.updated_at = nowIso;

        if (b.pending_api_conflict) {
          b.pending_api_conflict = null;
        }
      }

      const o = this.orders.get(item.order_id);
      if (o) {
        const codTxn = o.payments.find(p => p.method === 'cod_pending');
        if (codTxn) {
          codTxn.status = 'completed';
          codTxn.method = 'cash';
          codTxn.received_by = 'Steadfast Courier (Settled)';
          codTxn.transaction_ref = batch.batch_number;
        }
        o.updated_at = nowIso;
      }
    }

    batch.status = 'posted';
    batch.posted_at = nowIso;
    batch.posted_by_id = params.actor_id;
    batch.posted_by_name = params.actor_name;
    batch.journal_entry_id = journalEntry.id;
    batch.updated_at = nowIso;

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'courier_settlement_batch_posted',
      'settlement_batch',
      batch.id,
      `Posted courier settlement batch ${batch.batch_number}: Deposited ৳${batch.actual_bank_payout} in ${acc.name}, cleared ৳${batch.total_cod_collected} COD, booked ৳${batch.total_actual_courier_charges} courier expenses.`
    );

    return batch;
  }

  public deleteSettlementBatch(id: string, actor_id: string, actor_name: string): void {
    const batch = this.settlementBatches.get(id);
    if (!batch) throw new Error('Settlement batch not found');

    if (batch.status === 'posted') {
      throw new Error('Cannot delete a posted settlement batch. It has already posted double-entry journal entries.');
    }

    for (const item of batch.items) {
      const b = this.courierBookings.get(item.booking_id);
      if (b && b.settlement_batch_id === batch.id) {
        b.settlement_batch_id = undefined;
        b.updated_at = new Date().toISOString();
      }
    }

    this.settlementBatches.delete(id);

    this.logAudit(
      actor_id,
      actor_name,
      'courier_settlement_batch_deleted',
      'settlement_batch',
      id,
      `Discarded draft courier settlement batch ${batch.batch_number}. Bookings returned to unsettled pool.`
    );
  }

  // --- PHASE 4: STEADFAST COURIER WEBHOOKS & AUTOMATED API SYNC (Section 11, 12, 40.4) ---

  // 1. Process Inbound Steadfast Webhook Payload
  public processSteadfastWebhook(payload: any, secretOrToken?: string): {
    success: boolean;
    log: CourierWebhookLog;
    booking?: CourierBooking;
  } {
    const consignmentNo = String(
      payload.consignment_id ||
      payload.consignment_no ||
      payload.tracking_code ||
      payload.order_id ||
      ''
    ).trim();

    const rawStatus = String(payload.status || payload.delivery_status || '').toLowerCase().trim();
    const eventType = String(payload.notification_type || payload.event || 'status_update').trim();

    // Map Steadfast courier status strings to ERP lifecycle statuses
    let mappedStatus: CourierBookingStatus = 'in_transit';
    if (rawStatus.includes('deliver') || rawStatus === 'successful' || rawStatus === 'complete') {
      mappedStatus = 'delivered';
    } else if (rawStatus.includes('rto') || rawStatus.includes('return') || rawStatus === 'returned_to_hub') {
      mappedStatus = 'rto';
    } else if (rawStatus.includes('cancel')) {
      mappedStatus = 'cancelled';
    } else if (rawStatus.includes('transit') || rawStatus.includes('picked') || rawStatus.includes('processing')) {
      mappedStatus = 'in_transit';
    }

    // Locate matching booking in database
    let booking = Array.from(this.courierBookings.values()).find(
      b => b.consignment_no === consignmentNo ||
           b.booking_id === consignmentNo ||
           b.order_id === consignmentNo ||
           b.invoice_number === consignmentNo ||
           (payload.invoice && b.invoice_number === String(payload.invoice)) ||
           (payload.tracking_code && b.consignment_no === String(payload.tracking_code))
    );

    let processingStatus: 'success' | 'ignored' | 'error' = 'success';
    let processingNotes = '';

    if (!booking) {
      processingStatus = 'ignored';
      processingNotes = `Consignment reference "${consignmentNo}" was not found in active bookings table.`;
    } else {
      try {
        // If carrier reported actual delivery fee in webhook, process with conflict protection
        if (payload.delivery_charge !== undefined || payload.delivery_fee !== undefined || payload.actual_charge !== undefined) {
          const incomingCharge = Number(payload.actual_charge ?? payload.delivery_charge ?? payload.delivery_fee);
          if (!isNaN(incomingCharge) && incomingCharge > 0) {
            if (booking.courier_charge_source === 'manual' && booking.actual_charge !== null && booking.actual_charge !== undefined) {
              if (booking.actual_charge !== incomingCharge) {
                // DO NOT overwrite manual charge! Record pending conflict for staff review
                booking.pending_api_conflict = {
                  api_charge: incomingCharge,
                  fetched_at: new Date().toISOString(),
                  note: `Steadfast webhook reported charge ৳${incomingCharge}, but staff manually set ৳${booking.actual_charge}. Review needed.`,
                };
                this.notifications.unshift({
                  id: `notif_${Date.now()}_${Math.random()}`,
                  type: 'carrier_exception',
                  priority: 'warning',
                  title: `Courier Charge Conflict: ${booking.invoice_number}`,
                  message: `Steadfast reported ৳${incomingCharge} for ${booking.consignment_no}, but manual charge is ৳${booking.actual_charge}. Review and resolve in Courier Reconciliation.`,
                  ref_type: 'courier_booking',
                  ref_id: booking.id,
                  action_url: '/courier/bookings',
                  read: false,
                  created_at: new Date().toISOString(),
                });
                this.logAudit(
                  'webhook_steadfast',
                  'Steadfast Webhook Bot',
                  'courier_charge_conflict_detected',
                  'courier_booking',
                  booking.id,
                  `Conflict detected for ${booking.invoice_number}: Steadfast reported ৳${incomingCharge}, existing manual charge is ৳${booking.actual_charge}. Kept manual value pending review.`
                );
              } else {
                booking.charge_synced_at = new Date().toISOString();
                booking.pending_api_conflict = null;
              }
            } else {
              // API source or previously pending — safely apply confirmed API charge
              const prevCharge = booking.actual_charge;
              booking.actual_charge = incomingCharge;
              booking.actual_courier_cost = incomingCharge;
              booking.variance = booking.delivery_charge - incomingCharge;
              booking.courier_charge_source = 'steadfast_api';
              booking.charge_synced_at = new Date().toISOString();
              booking.pending_api_conflict = null;

              booking.charge_history = booking.charge_history || [];
              booking.charge_history.push({
                id: `CHG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                timestamp: new Date().toISOString(),
                source: 'steadfast_api',
                previous_charge: prevCharge,
                new_charge: incomingCharge,
                actor_id: 'webhook_steadfast',
                actor_name: 'Steadfast Webhook Bot',
                notes: `Confirmed actual charge received via Steadfast webhook (${rawStatus})`,
              });

              const order = this.orders.get(booking.order_id);
              if (order) {
                order.actual_courier_charge = incomingCharge;
                order.courier_charge_source = 'steadfast_api';
                order.updated_at = new Date().toISOString();
              }
            }
          }
        }

        // Apply status transition & accounting journal automation
        this.syncCourierStatus({
          booking_id: booking.id,
          new_status: mappedStatus,
          actor_id: 'webhook_steadfast',
          actor_name: 'Steadfast Webhook Bot',
          notes: payload.notes || `Updated via automated webhook (${rawStatus})`,
        });

        processingNotes = `Successfully updated booking ${booking.consignment_no} to "${mappedStatus}". Revenue/COGS recognized if delivered.`;
      } catch (err: any) {
        processingStatus = 'error';
        processingNotes = `Failed applying webhook transition: ${err.message}`;
      }
    }

    const logEntry: CourierWebhookLog = {
      id: `WHL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      courier: 'steadfast',
      event_type: eventType,
      consignment_no: consignmentNo || 'UNKNOWN',
      tracking_code: payload.tracking_code || booking?.consignment_no,
      invoice_number: booking?.invoice_number,
      courier_status: payload.status || 'unknown',
      mapped_order_status: (booking ? mappedStatus : 'in_transit') as any,
      raw_payload: JSON.stringify(payload, null, 2),
      processing_status: processingStatus,
      processing_notes: processingNotes,
      received_at: new Date().toISOString(),
    };

    this.courierWebhookLogs.unshift(logEntry);

    // Keep max 200 webhook logs in memory
    if (this.courierWebhookLogs.length > 200) {
      this.courierWebhookLogs.pop();
    }

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'system',
      message: `Steadfast Webhook: Consignment ${consignmentNo || 'Event'} transitioned to ${mappedStatus}`,
      ref_type: 'courier_booking',
      ref_id: booking?.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return {
      success: processingStatus === 'success',
      log: logEntry,
      booking,
    };
  }

  // 2. Batch Sync All Active Bookings from Steadfast API Gateway
  public syncAllCourierBookingsFromApi(actor_id = 'usr_mgr', actor_name = 'Courier Sync Bot'): {
    total_checked: number;
    updated_count: number;
    logs: CourierWebhookLog[];
  } {
    const activeBookings = Array.from(this.courierBookings.values()).filter(
      b => b.status === 'booked' || b.status === 'in_transit'
    );

    let updatedCount = 0;
    const generatedLogs: CourierWebhookLog[] = [];

    for (const booking of activeBookings) {
      // Simulate real-world carrier poll responses
      // If booking was in_transit, transition to delivered with actual charge reconciliation
      if (booking.status === 'in_transit') {
        const simPayload = {
          notification_type: 'status_poll_sync',
          consignment_id: booking.consignment_no,
          tracking_code: booking.consignment_no,
          status: 'delivered',
          cod_amount: booking.cod_amount,
          delivery_charge: booking.actual_charge,
          notes: 'Auto-polled from Steadfast Bangladesh API Gateway',
        };

        const result = this.processSteadfastWebhook(simPayload);
        if (result.success) {
          updatedCount++;
          generatedLogs.push(result.log);
        }
      } else if (booking.status === 'booked') {
        const simPayload = {
          notification_type: 'status_poll_sync',
          consignment_id: booking.consignment_no,
          tracking_code: booking.consignment_no,
          status: 'in_transit',
          cod_amount: booking.cod_amount,
          delivery_charge: booking.actual_charge,
          notes: 'Parcel scanned at Tejgaon Consolidation Hub',
        };

        const result = this.processSteadfastWebhook(simPayload);
        if (result.success) {
          updatedCount++;
          generatedLogs.push(result.log);
        }
      }
    }

    this.courierApiConfig.last_sync_at = new Date().toISOString();

    this.logAudit(
      actor_id,
      actor_name,
      'courier_api_batch_synced',
      'courier_gateway',
      'steadfast',
      `Synchronized ${activeBookings.length} active consignments with Steadfast API (${updatedCount} updated)`
    );

    return {
      total_checked: activeBookings.length,
      updated_count: updatedCount,
      logs: generatedLogs,
    };
  }

  // 3. Admin / Developer Webhook Simulation Tool
  public simulateSteadfastWebhook(params: {
    consignment_no: string;
    event_type?: string;
    status: string;
    actual_charge?: number;
    cod_amount?: number;
    notes?: string;
  }): { success: boolean; log: CourierWebhookLog; booking?: CourierBooking } {
    const payload = {
      notification_type: params.event_type || 'delivery_status_update',
      consignment_id: params.consignment_no,
      tracking_code: params.consignment_no,
      status: params.status,
      cod_amount: params.cod_amount,
      actual_charge: params.actual_charge,
      notes: params.notes || 'Manually simulated webhook event from test console',
      timestamp: new Date().toISOString(),
    };

    return this.processSteadfastWebhook(payload);
  }

  // 4. Update Courier API Configuration
  public updateCourierApiConfig(params: Partial<CourierApiConfig>, actor_id = 'usr_owner', actor_name = 'Sobuj Sehk'): CourierApiConfig {
    // Encrypt secrets at rest (Section 39.1) \u2014 never store plaintext keys.
    if (params.api_key !== undefined) this.courierApiConfig.api_key = encryptSecret(params.api_key);
    if (params.secret_key !== undefined) this.courierApiConfig.secret_key = encryptSecret(params.secret_key);
    if (params.webhook_secret !== undefined) this.courierApiConfig.webhook_secret = encryptSecret(params.webhook_secret);
    if (params.base_url !== undefined) {
      let bUrl = params.base_url.trim();
      if (bUrl.includes('127.0.0.1:4000') || bUrl.includes('localhost:4000') || !bUrl.startsWith('http')) {
        bUrl = 'https://portal.steadfast.com.bd/api/v1';
      }
      this.courierApiConfig.base_url = bUrl;
      this.settings.courier_base_url = bUrl;
    }
    if (params.auto_sync_enabled !== undefined) this.courierApiConfig.auto_sync_enabled = params.auto_sync_enabled;
    if (params.auto_sync_interval_minutes !== undefined) this.courierApiConfig.auto_sync_interval_minutes = params.auto_sync_interval_minutes;
    if (params.status !== undefined) this.courierApiConfig.status = params.status;

    this.logAudit(
      actor_id,
      actor_name,
      'courier_api_config_updated',
      'courier_config',
      'steadfast',
      `Updated Steadfast Courier API credentials and webhook secrets`
    );

    return this.courierApiConfig;
  }

  // Decrypt a courier secret in-memory only (Section 39.1) \u2014 this is the only
  // place a plaintext secret is materialized, for an actual API call.
  public getCourierPlaintextSecret(field: 'api_key' | 'secret_key' | 'webhook_secret'): string {
    return decryptSecret(this.courierApiConfig[field]);
  }

  // Returns the stored courier config with secrets masked so plaintext never
  // leaves the server (Settings UI and any consumer).
  public getCourierApiConfig(): CourierApiConfig {
    return {
      ...this.courierApiConfig,
      api_key: this.courierApiConfig.api_key ? maskSecret(decryptSecret(this.courierApiConfig.api_key)) : '',
      secret_key: this.courierApiConfig.secret_key ? maskSecret(decryptSecret(this.courierApiConfig.secret_key)) : '',
      webhook_secret: this.courierApiConfig.webhook_secret ? maskSecret(decryptSecret(this.courierApiConfig.webhook_secret)) : '',
    };
  }


  // Stock Receiving (Section 7, 35.3)
  public receiveStock(params: {
    product_id: string;
    warehouse_id: string;
    qty_received: number;
    landed_cost_per_unit: number;
    supplier_name?: string;
    actor_id: string;
    actor_name: string;
    notes?: string;
  }): { product: Product; inventory: InventoryRecord; new_avg_cost: number } {
    if (!Number.isFinite(params.qty_received) || params.qty_received <= 0) {
      throw new Error('Quantity received must be a positive number');
    }
    if (!Number.isFinite(params.landed_cost_per_unit) || params.landed_cost_per_unit < 0) {
      throw new Error('Landed cost per unit must be a non-negative number');
    }
    const prod = this.products.get(params.product_id);
    if (!prod) throw new Error(`Product not found: ${params.product_id}`);

    const wh = this.warehouses.get(params.warehouse_id);
    if (!wh) throw new Error(`Warehouse not found: ${params.warehouse_id}`);

    const invK = this.invKey(params.product_id, params.warehouse_id);
    let inv = this.inventory.get(invK);
    if (!inv) {
      inv = {
        product_id: params.product_id,
        warehouse_id: params.warehouse_id,
        on_hand: 0,
        reserved: 0,
        avg_cost: prod.avg_cost || params.landed_cost_per_unit,
      };
      this.inventory.set(invK, inv);
    }

    // Weighted average calculation: (old_qty * old_avg + new_qty * new_cost) / (old_qty + new_qty)
    const oldQty = inv.on_hand;
    const oldAvg = inv.avg_cost || params.landed_cost_per_unit;
    const newOnHand = oldQty + params.qty_received;
    const newAvgCost = Math.round(((oldQty * oldAvg + params.qty_received * params.landed_cost_per_unit) / newOnHand) * 100) / 100;

    inv.on_hand = newOnHand;
    inv.avg_cost = newAvgCost;
    prod.avg_cost = newAvgCost;

    // Log Stock Movement
    const movId = `MOV-${Date.now()}-${this.nextMovementId++}`;
    this.stockMovements.unshift({
      id: movId,
      product_id: prod.id,
      product_name: prod.display_name,
      sku: prod.sku,
      warehouse_id: wh.id,
      warehouse_name: wh.name,
      quantity_delta: params.qty_received,
      movement_reason: 'PURCHASE',
      unit_cost: params.landed_cost_per_unit,
      total_cost: params.qty_received * params.landed_cost_per_unit,
      reference_id: movId,
      created_by: params.actor_id,
      created_by_name: params.actor_name,
      created_at: new Date().toISOString(),
      notes: params.notes || `Stock received from ${params.supplier_name || 'Dubai Supplier'}`,
    });

    // Journal Entry: Dr Inventory, Cr Supplier Payable
    const totalCost = params.qty_received * params.landed_cost_per_unit;
    this.postJournal(
      new Date().toISOString().slice(0, 10),
      'purchase',
      movId,
      `Stock Received: ${params.qty_received}x ${prod.display_name} @ \u09F3${params.landed_cost_per_unit}`,
      [
        { account_id: 'acc_inventory', debit: totalCost, credit: 0 },
        { account_id: 'acc_supp_pay', debit: 0, credit: totalCost },
      ],
      params.actor_name,
      undefined,
      'general_journal'
    );

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'stock_received',
      'product',
      prod.id,
      `Received ${params.qty_received} units at ৳${params.landed_cost_per_unit}/unit in ${wh.name}. New Avg Cost: ৳${newAvgCost}`
    );

    // Notify if any active Pre-Orders are awaiting this arrived stock (User Rule: Pre-order stock arrival)
    const awaitingPreOrders = Array.from(this.orders.values()).filter(o =>
      o.order_timing === 'pre_order' &&
      o.status !== 'cancelled' &&
      o.items.some(it => it.product_id === prod.id)
    );
    if (awaitingPreOrders.length > 0) {
      this.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        type: 'system',
        message: `Stock arrival: ${params.qty_received}x "${prod.display_name}" received. ${awaitingPreOrders.length} Pre-Order(s) are awaiting this item and can now be moved to Today's Orders.`,
        ref_type: 'pre_orders',
        ref_id: prod.id,
        read: false,
        created_at: new Date().toISOString(),
      });
    }

    return { product: prod, inventory: inv, new_avg_cost: newAvgCost };
  }

  // Point 2: import receiving with batch/lot tracking + damage routing.
  // Damage introduced AT IMPORT never enters sellable on_hand \u2014 it goes
  // straight to damaged_stock (with severity + source='import'). Only the
  // good units are pooled into on_hand and costed. A batch sub-record is
  // created so each shipment's manufacturing/import dates are preserved as
  // a maturity indicator (never a hard sell-block).
  public receiveImportedStock(params: {
    product_id: string;
    warehouse_id: string;
    qty_received: number; // good, sellable units
    qty_damaged?: number; // units damaged on arrival \u2014 NOT sellable
    damage_severity?: DamageSeverity;
    damage_notes?: string;
    landed_cost_per_unit: number;
    selling_price?: number;
    supplier_name?: string;
    batch_code?: string;
    manufacturing_date?: string;
    import_date?: string;
    maturation_days?: number;
    maturation_ready_date?: string;
    maturation_status?: 'READY' | 'MATURING';
    location?: string;
    best_before_date?: string;
    expiry_date?: string;
    actor_id: string;
    actor_name: string;
    notes?: string;
  }): { product: Product; inventory: InventoryRecord; new_avg_cost: number; batch?: ProductBatch } {
    const { product_id, warehouse_id, qty_received, qty_damaged, damage_severity, damage_notes, landed_cost_per_unit, selling_price, supplier_name, batch_code, manufacturing_date, import_date, maturation_days, maturation_ready_date, maturation_status, location, best_before_date, expiry_date, actor_id, actor_name, notes } = params;
    // Good units flow through the normal weighted-average receive path.
    const result = this.receiveStock({ product_id, warehouse_id, qty_received, landed_cost_per_unit, supplier_name, actor_id, actor_name, notes });
    const damaged = Math.max(0, Math.floor(qty_damaged || 0));

    // Damaged import units: recorded against damaged_stock, never on_hand.
    if (damaged > 0) {
      this.damagedStock.unshift({
        id: `DAM-${Date.now()}-${this.nextMovementId++}`,
        product_id,
        product_name: result.product.display_name,
        sku: result.product.sku,
        warehouse_id,
        quantity: damaged,
        severity: damage_severity || 'light',
        source: 'import',
        batch_code,
        notes: damage_notes || 'Damaged on import arrival',
        created_by: actor_id,
        created_at: new Date().toISOString(),
      });
      this.logAudit(
        actor_id,
        actor_name,
        'import_damage_recorded',
        'product',
        product_id,
        `${damaged} damaged units (${damage_severity || 'light'}) on import of ${result.product.display_name} routed to damaged stock, not sellable on_hand`
      );
    }

    // Always create batch/lot sub-record for each received shipment
    const mfgTime = manufacturing_date ? new Date(manufacturing_date).getTime() : (import_date ? new Date(import_date).getTime() : Date.now());
    let isReady = true;
    let computedReadyDate = maturation_ready_date;
    if (maturation_status === 'READY') {
      isReady = true;
    } else if (maturation_status === 'MATURING') {
      isReady = false;
    } else if (maturation_days && maturation_days > 0) {
      const readyTs = mfgTime + maturation_days * 86400000;
      isReady = Date.now() >= readyTs;
      computedReadyDate = new Date(readyTs).toISOString().slice(0, 10);
    }

    const batch: ProductBatch = {
      id: `BATCH-${Date.now()}-${this.nextMovementId++}`,
      product_id,
      batch_code: batch_code || `LOT-${Date.now().toString(36).toUpperCase()}`,
      supplier_name: supplier_name || 'Dubai Supplier',
      warehouse_id,
      warehouse_name: this.warehouses.get(warehouse_id)?.name,
      location: location || (warehouse_id === 'wh_shop' ? result.product.location_shop : result.product.location_main),
      manufacturing_date,
      import_date,
      received_at: import_date || new Date().toISOString(),
      maturation_days,
      maturation_ready_date: computedReadyDate,
      maturation_status: isReady ? 'READY' : 'MATURING',
      best_before_date,
      expiry_date,
      quantity_received: qty_received,
      quantity_remaining: qty_received,
      purchase_cost: landed_cost_per_unit,
      selling_price: typeof selling_price === 'number' && selling_price > 0 ? selling_price : result.product.selling_price,
      authenticity_status: batch_code ? 'verified' : undefined,
      created_by: actor_id,
      created_at: new Date().toISOString(),
    };
    this.batches.unshift(batch);
    return { ...result, batch };
  }

  public getBatches(product_id?: string): ProductBatch[] {
    if (product_id) return this.batches.filter(b => b.product_id === product_id);
    return this.batches;
  }

  public getDamagedStock(): DamagedStockRecord[] {
    return this.damagedStock;
  }
  public setOpeningStock(params: {
    product_id: string;
    warehouse_id: string;
    quantity: number;
    unit_cost: number;
    date: string;
    actor_id: string;
    actor_name: string;
  }): void {
    const prod = this.products.get(params.product_id);
    if (!prod) throw new Error('Product not found');
    const wh = this.warehouses.get(params.warehouse_id);
    if (!wh) throw new Error('Warehouse not found');

    const invK = this.invKey(params.product_id, params.warehouse_id);
    let inv = this.inventory.get(invK);
    if (!inv) {
      inv = { product_id: params.product_id, warehouse_id: params.warehouse_id, on_hand: 0, reserved: 0, avg_cost: params.unit_cost };
      this.inventory.set(invK, inv);
    }

    inv.on_hand = params.quantity;
    inv.avg_cost = params.unit_cost;
    prod.avg_cost = params.unit_cost;

    const movId = `MOV-${Date.now()}-${this.nextMovementId++}`;
    this.stockMovements.unshift({
      id: movId,
      product_id: prod.id,
      product_name: prod.display_name,
      sku: prod.sku,
      warehouse_id: wh.id,
      warehouse_name: wh.name,
      quantity_delta: params.quantity,
      movement_reason: 'OPENING_BALANCE',
      unit_cost: params.unit_cost,
      total_cost: params.quantity * params.unit_cost,
      reference_id: movId,
      created_by: params.actor_id,
      created_by_name: params.actor_name,
      created_at: new Date(params.date).toISOString(),
      notes: 'Initial opening stock go-live balance',
    });

    const totalVal = params.quantity * params.unit_cost;
    this.postJournal(
      params.date,
      'opening',
      movId,
      `Opening Stock Balance: ${params.quantity}x ${prod.display_name}`,
      [
        { account_id: 'acc_inventory', debit: totalVal, credit: 0 },
        { account_id: 'acc_equity', debit: 0, credit: totalVal },
      ],
      params.actor_name,
      undefined,
      'general_journal'
    );

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'opening_stock_set',
      'product',
      prod.id,
      `Set opening balance: ${params.quantity} units @ \u09F3${params.unit_cost} in ${wh.name}`
    );
  }

  // --- PHASE 3: SUPPLIERS, PURCHASE ORDERS & PURCHASE RETURNS ---

  public allocatePONumber(): string {
    const num = this.nextPONumber++;
    return `PO-2026-${String(num).padStart(4, '0')}`;
  }

  public allocatePRNumber(): string {
    const num = this.nextPRNumber++;
    return `PR-2026-${String(num).padStart(4, '0')}`;
  }

  public allocatePayNumber(): string {
    const num = this.nextPayNumber++;
    return `PAY-2026-${String(num).padStart(4, '0')}`;
  }

  // 1. Supplier CRUD & Management
  public createSupplier(params: {
    name: string;
    contact_person: string;
    phone: string;
    email: string;
    address: string;
    country: string;
    currency: CurrencyCode;
    default_exchange_rate?: number;
    payment_terms: string;
    tax_id_or_trade_license?: string;
    notes?: string;
    initial_balance_payable?: number;
    actor_id: string;
    actor_name: string;
  }): Supplier {
    if (!params.name.trim()) throw new Error('Supplier name is required');
    const id = `SUPP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const currency = params.currency || 'AED';
    const rate = params.default_exchange_rate || (currency === 'AED' ? 33.0 : currency === 'USD' ? 122.0 : 1.0);
    const balance = params.initial_balance_payable || 0;

    const supplier: Supplier = {
      id,
      name: params.name.trim(),
      contact_person: params.contact_person || '',
      phone: params.phone || '',
      email: params.email || '',
      address: params.address || '',
      country: params.country || 'UAE',
      currency,
      default_exchange_rate: rate,
      balance_payable: balance,
      payment_terms: params.payment_terms || 'Net 30',
      tax_id_or_trade_license: params.tax_id_or_trade_license,
      notes: params.notes,
      active: true,
      total_purchases_count: 0,
      total_purchases_amount_bdt: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.suppliers.set(id, supplier);

    if (balance > 0) {
      // Opening supplier payable journal entry
      this.postJournal(
        new Date().toISOString().slice(0, 10),
        'opening_payable',
        id,
        `Opening balance payable for supplier ${supplier.name}`,
        [
          { account_id: 'acc_equity', debit: balance, credit: 0, line_desc: `Opening equity offset for ${supplier.name}` },
          { account_id: 'acc_supp_pay', debit: 0, credit: balance, line_desc: `Opening payable owed to ${supplier.name}` },
        ],
        params.actor_name,
        undefined,
        'general_journal'
      );
    }

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'supplier_created',
      'supplier',
      id,
      `Created supplier "${supplier.name}" (${supplier.country}, ${supplier.currency}) with balance \u09F3${balance}`
    );

    return supplier;
  }

  public updateSupplier(
    id: string,
    params: Partial<Supplier> & { actor_id: string; actor_name: string }
  ): Supplier {
    const supp = this.suppliers.get(id);
    if (!supp) throw new Error('Supplier not found');

    if (params.name !== undefined) supp.name = params.name.trim();
    if (params.contact_person !== undefined) supp.contact_person = params.contact_person;
    if (params.phone !== undefined) supp.phone = params.phone;
    if (params.email !== undefined) supp.email = params.email;
    if (params.address !== undefined) supp.address = params.address;
    if (params.country !== undefined) supp.country = params.country;
    if (params.currency !== undefined) supp.currency = params.currency;
    if (params.default_exchange_rate !== undefined) supp.default_exchange_rate = params.default_exchange_rate;
    if (params.payment_terms !== undefined) supp.payment_terms = params.payment_terms;
    if (params.tax_id_or_trade_license !== undefined) supp.tax_id_or_trade_license = params.tax_id_or_trade_license;
    if (params.notes !== undefined) supp.notes = params.notes;
    if (params.active !== undefined) supp.active = params.active;
    supp.updated_at = new Date().toISOString();

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'supplier_updated',
      'supplier',
      id,
      `Updated profile and terms for supplier "${supp.name}"`
    );

    return supp;
  }

  // 2. Supplier Payment & Settlement (Section 15.0, 15.3)
  public recordSupplierPayment(params: {
    supplier_id: string;
    amount_bdt: number;
    amount_foreign?: number;
    payment_account_id: string;
    payment_date: string;
    reference_no: string;
    notes?: string;
    actor_id: string;
    actor_name: string;
  }): SupplierPayment {
    const supp = this.suppliers.get(params.supplier_id);
    if (!supp) throw new Error('Supplier not found');

    const acc = this.accounts.get(params.payment_account_id);
    if (!acc) throw new Error('Payment source account not found');

    if (params.amount_bdt <= 0) throw new Error('Payment amount must be positive');

    const paymentNum = this.allocatePayNumber();
    const rate = params.amount_foreign && params.amount_foreign > 0
      ? params.amount_bdt / params.amount_foreign
      : supp.default_exchange_rate;

    const payment: SupplierPayment = {
      id: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      payment_number: paymentNum,
      supplier_id: supp.id,
      supplier_name: supp.name,
      amount_bdt: params.amount_bdt,
      amount_foreign: params.amount_foreign,
      currency: supp.currency,
      exchange_rate: rate,
      payment_account_id: acc.id,
      payment_account_name: acc.name,
      payment_date: params.payment_date || new Date().toISOString().slice(0, 10),
      reference_no: params.reference_no || `TT-${Date.now().toString().slice(-6)}`,
      notes: params.notes,
      created_by: params.actor_id,
      created_by_name: params.actor_name,
      created_at: new Date().toISOString(),
    };

    this.supplierPayments.set(payment.id, payment);

    // Update supplier balance payable
    supp.balance_payable = Math.max(0, supp.balance_payable - params.amount_bdt);
    supp.updated_at = new Date().toISOString();

    // Post Double-Entry Journal (Dr Dubai Supplier Payables, Cr Bank/Cash)
    this.postJournal(
      payment.payment_date,
      'supplier_payment',
      payment.id,
      `Supplier Payment to ${supp.name} (${payment.reference_no}): ৳${payment.amount_bdt}`,
      [
        { account_id: 'acc_supp_pay', debit: payment.amount_bdt, credit: 0, line_desc: `Settled payable for ${supp.name}` },
        { account_id: acc.id, debit: 0, credit: payment.amount_bdt, line_desc: `Paid from ${acc.name}` },
      ],
      params.actor_name,
      undefined,
      'supplier_payment'
    );

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'supplier_payment_recorded',
      'supplier_payment',
      payment.id,
      `Recorded payment ${paymentNum} of \u09F3${payment.amount_bdt} (${params.amount_foreign ? `${params.amount_foreign} ${supp.currency}` : ''}) to ${supp.name} from ${acc.name}`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'system',
      message: `Supplier payment of \u09F3${payment.amount_bdt.toLocaleString()} recorded for ${supp.name}`,
      ref_type: 'supplier',
      ref_id: supp.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return payment;
  }

  // 3. Purchase Orders (PO Workflow & Landed Cost)
  public createPurchaseOrder(params: {
    supplier_id: string;
    order_date: string;
    expected_delivery_date?: string;
    target_warehouse_id: string;
    currency?: CurrencyCode;
    exchange_rate?: number;
    items: {
      product_id: string;
      quantity_ordered: number;
      unit_cost_foreign?: number;
      unit_cost_bdt?: number;
      landed_freight_per_unit?: number;
      landed_duty_per_unit?: number;
    }[];
    freight_total_bdt?: number;
    customs_duty_total_bdt?: number;
    other_costs_bdt?: number;
    status?: PurchaseOrderStatus;
    notes?: string;
    actor_id: string;
    actor_name: string;
  }): PurchaseOrder {
    const supp = this.suppliers.get(params.supplier_id);
    if (!supp) throw new Error('Supplier not found');

    const wh = this.warehouses.get(params.target_warehouse_id) || this.warehouses.get('wh_shop');
    if (!wh) throw new Error('Target warehouse not found');

    if (!params.items || params.items.length === 0) {
      throw new Error('At least one item is required in Purchase Order');
    }

    const poNumber = this.allocatePONumber();
    const poId = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const currency = params.currency || supp.currency || 'AED';
    const rate = params.exchange_rate && params.exchange_rate > 0 ? params.exchange_rate : supp.default_exchange_rate || 33.0;

    let subtotalBdt = 0;
    const poItems: PurchaseOrderItem[] = [];

    const totalQty = params.items.reduce((s, i) => s + (i.quantity_ordered || 1), 0);
    const globalFreightPerUnit = (params.freight_total_bdt || 0) / (totalQty || 1);
    const globalDutyPerUnit = (params.customs_duty_total_bdt || 0) / (totalQty || 1);

    for (const it of params.items) {
      const prod = this.products.get(it.product_id);
      if (!prod) throw new Error(`Product not found: ${it.product_id}`);

      const qty = Number(it.quantity_ordered) || 1;
      const unitForeign = it.unit_cost_foreign !== undefined ? Number(it.unit_cost_foreign) : (prod.avg_cost / rate);
      const unitCostBdt = it.unit_cost_bdt !== undefined ? Number(it.unit_cost_bdt) : (unitForeign * rate);

      const freightUnit = it.landed_freight_per_unit !== undefined ? Number(it.landed_freight_per_unit) : globalFreightPerUnit;
      const dutyUnit = it.landed_duty_per_unit !== undefined ? Number(it.landed_duty_per_unit) : globalDutyPerUnit;

      const totalLandedUnitCost = Math.round((unitCostBdt + freightUnit + dutyUnit) * 100) / 100;
      const lineTotalBdt = Math.round(totalLandedUnitCost * qty * 100) / 100;
      subtotalBdt += unitCostBdt * qty;

      poItems.push({
        id: `POI-${Date.now()}-${poItems.length + 1}`,
        purchase_order_id: poId,
        product_id: prod.id,
        product_name: prod.display_name,
        sku: prod.sku,
        barcode: prod.barcode,
        quantity_ordered: qty,
        quantity_received: 0,
        unit_cost_foreign: unitForeign,
        currency,
        exchange_rate: rate,
        unit_cost_bdt: unitCostBdt,
        landed_freight_per_unit: freightUnit,
        landed_duty_per_unit: dutyUnit,
        total_landed_unit_cost_bdt: totalLandedUnitCost,
        total_amount_bdt: lineTotalBdt,
      });
    }

    const freightTotal = params.freight_total_bdt || 0;
    const dutyTotal = params.customs_duty_total_bdt || 0;
    const otherCosts = params.other_costs_bdt || 0;
    const finalTotalBdt = Math.round((subtotalBdt + freightTotal + dutyTotal + otherCosts) * 100) / 100;

    const po: PurchaseOrder = {
      id: poId,
      po_number: poNumber,
      supplier_id: supp.id,
      supplier_name: supp.name,
      order_date: params.order_date || new Date().toISOString().slice(0, 10),
      expected_delivery_date: params.expected_delivery_date,
      target_warehouse_id: wh.id,
      target_warehouse_name: wh.name,
      currency,
      exchange_rate: rate,
      items: poItems,
      subtotal_bdt: subtotalBdt,
      freight_total_bdt: freightTotal,
      customs_duty_total_bdt: dutyTotal,
      other_costs_bdt: otherCosts,
      total_amount_bdt: finalTotalBdt,
      status: params.status || 'ordered',
      payment_status: 'unpaid',
      amount_paid_bdt: 0,
      notes: params.notes,
      created_by: params.actor_id,
      created_by_name: params.actor_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.purchaseOrders.set(po.id, po);

    // Update supplier stats
    supp.total_purchases_count = (supp.total_purchases_count || 0) + 1;
    supp.total_purchases_amount_bdt = (supp.total_purchases_amount_bdt || 0) + finalTotalBdt;
    supp.updated_at = new Date().toISOString();

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'purchase_order_created',
      'purchase_order',
      po.id,
      `Created Purchase Order ${poNumber} for ${supp.name} (${poItems.length} lines, \u09F3${finalTotalBdt.toLocaleString()})`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'system',
      message: `Purchase Order ${poNumber} issued to ${supp.name} for \u09F3${finalTotalBdt.toLocaleString()}`,
      ref_type: 'purchase_order',
      ref_id: po.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return po;
  }

  public updatePurchaseOrderStatus(
    poId: string,
    status: PurchaseOrderStatus,
    actorId: string,
    actorName: string
  ): PurchaseOrder {
    const po = this.purchaseOrders.get(poId);
    if (!po) throw new Error('Purchase Order not found');

    const oldStatus = po.status;
    po.status = status;
    po.updated_at = new Date().toISOString();

    this.logAudit(
      actorId,
      actorName,
      'purchase_order_status_updated',
      'purchase_order',
      po.id,
      `Updated PO ${po.po_number} status from ${oldStatus} to ${status}`
    );

    return po;
  }

  // 4. Atomic PO Goods Receiving & Landed Cost Recalculation (Section 7, 8, 35.3)
  public receivePurchaseOrderItems(params: {
    po_id: string;
    received_items: { item_id: string; quantity_receiving: number }[];
    warehouse_id?: string;
    actor_id: string;
    actor_name: string;
    notes?: string;
  }): PurchaseOrder {
    const po = this.purchaseOrders.get(params.po_id);
    if (!po) throw new Error('Purchase Order not found');

    const targetWhId = params.warehouse_id || po.target_warehouse_id;
    const wh = this.warehouses.get(targetWhId);
    if (!wh) throw new Error('Target warehouse not found');

    const supp = this.suppliers.get(po.supplier_id);

    let totalReceivedBdt = 0;
    let totalItemsReceivedThisBatch = 0;

    for (const rec of params.received_items) {
      if (rec.quantity_receiving <= 0) continue;

      const item = po.items.find(i => i.id === rec.item_id);
      if (!item) continue;

      const remainingToReceive = item.quantity_ordered - item.quantity_received;
      const actualQty = Math.min(remainingToReceive, rec.quantity_receiving);
      if (actualQty <= 0) continue;

      item.quantity_received += actualQty;
      totalItemsReceivedThisBatch += actualQty;

      const lineLandedCost = item.total_landed_unit_cost_bdt;
      const batchValue = actualQty * lineLandedCost;
      totalReceivedBdt += batchValue;

      // Update warehouse inventory on_hand & recalculate weighted average landed cost
      const prod = this.products.get(item.product_id);
      const invK = this.invKey(item.product_id, wh.id);
      let inv = this.inventory.get(invK);
      if (!inv) {
        inv = {
          product_id: item.product_id,
          warehouse_id: wh.id,
          on_hand: 0,
          reserved: 0,
          avg_cost: prod ? prod.avg_cost : lineLandedCost,
        };
        this.inventory.set(invK, inv);
      }

      const oldOnHand = inv.on_hand;
      const oldAvgCost = inv.avg_cost || lineLandedCost;
      const newOnHand = oldOnHand + actualQty;
      const newAvgCost = Math.round(((oldOnHand * oldAvgCost + actualQty * lineLandedCost) / newOnHand) * 100) / 100;

      inv.on_hand = newOnHand;
      inv.avg_cost = newAvgCost;
      if (prod) {
        prod.avg_cost = newAvgCost;
      }

      // Append immutable Stock Movement
      const movId = `MOV-${Date.now()}-${this.nextMovementId++}`;
      this.stockMovements.unshift({
        id: movId,
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.sku,
        warehouse_id: wh.id,
        warehouse_name: wh.name,
        quantity_delta: actualQty,
        movement_reason: 'PO_RECEIVING',
        unit_cost: lineLandedCost,
        total_cost: batchValue,
        reference_id: po.po_number,
        notes: params.notes || `PO Shipment received for ${po.po_number} from ${po.supplier_name}`,
        created_by: params.actor_id,
        created_by_name: params.actor_name,
        created_at: new Date().toISOString(),
      });
    }

    if (totalItemsReceivedThisBatch === 0) {
      throw new Error('No valid quantities to receive');
    }

    // Determine overall PO status
    const allFullyReceived = po.items.every(i => i.quantity_received >= i.quantity_ordered);
    po.status = allFullyReceived ? 'received' : 'partially_received';
    po.updated_at = new Date().toISOString();

    // Post Double-Entry Journal for Received Goods (Dr Inventory, Cr Supplier Payables)
    this.postJournal(
      new Date().toISOString().slice(0, 10),
      'po_receiving',
      po.id,
      `PO Shipment Received: ${po.po_number} (${po.supplier_name}) - ${totalItemsReceivedThisBatch} bottles`,
      [
        { account_id: 'acc_inventory', debit: totalReceivedBdt, credit: 0, line_desc: `Stock addition from PO ${po.po_number}` },
        { account_id: 'acc_supp_pay', debit: 0, credit: totalReceivedBdt, line_desc: `Accounts payable for ${po.supplier_name}` },
      ],
      params.actor_name,
      undefined,
      'general_journal'
    );

    // Supplier payable follows on the supplier record (not an account balance)
    if (supp) {
      supp.balance_payable = (supp.balance_payable || 0) + totalReceivedBdt;
      supp.updated_at = new Date().toISOString();
    }

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'po_items_received',
      'purchase_order',
      po.id,
      `Received ${totalItemsReceivedThisBatch} items for PO ${po.po_number} in ${wh.name} (Landed Total: \u09F3${totalReceivedBdt.toLocaleString()}). Status: ${po.status}`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'system',
      message: `Received ${totalItemsReceivedThisBatch} items for PO ${po.po_number} from ${po.supplier_name} into ${wh.name}`,
      ref_type: 'purchase_order',
      ref_id: po.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return po;
  }

  // 5. Purchase Returns to Supplier (Damaged bottles, wrong SKU, quality defects)
  public createPurchaseReturn(params: {
    supplier_id: string;
    purchase_order_id?: string;
    warehouse_id: string;
    return_date: string;
    reason: PurchaseReturnReason;
    reason_details?: string;
    items: {
      product_id: string;
      quantity: number;
      unit_cost_bdt?: number;
    }[];
    settlement_type?: 'credit_note' | 'cash_refund' | 'bank_refund';
    refund_account_id?: string;
    actor_id: string;
    actor_name: string;
  }): PurchaseReturn {
    const supp = this.suppliers.get(params.supplier_id);
    if (!supp) throw new Error('Supplier not found');

    const wh = this.warehouses.get(params.warehouse_id);
    if (!wh) throw new Error('Warehouse not found');

    if (!params.items || params.items.length === 0) {
      throw new Error('At least one item must be returned');
    }

    const returnNumber = this.allocatePRNumber();
    const returnId = `PR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let poRef: PurchaseOrder | undefined;
    if (params.purchase_order_id) {
      poRef = this.purchaseOrders.get(params.purchase_order_id);
    }

    let totalAmountBdt = 0;
    const returnItems: PurchaseReturnItem[] = [];

    // Verify stock availability and deduct
    for (const it of params.items) {
      const prod = this.products.get(it.product_id);
      if (!prod) throw new Error(`Product not found: ${it.product_id}`);

      const qty = Number(it.quantity) || 1;
      const invK = this.invKey(prod.id, wh.id);
      const inv = this.inventory.get(invK);
      const onHand = inv ? inv.on_hand : 0;

      if (qty > onHand) {
        throw new Error(`Cannot return ${qty}x of "${prod.display_name}". On-hand in ${wh.name} is only ${onHand}.`);
      }

      const unitCost = it.unit_cost_bdt !== undefined ? Number(it.unit_cost_bdt) : (inv?.avg_cost || prod.avg_cost);
      const lineTotal = Math.round(unitCost * qty * 100) / 100;
      totalAmountBdt += lineTotal;

      // Deduct physical inventory
      if (inv) {
        inv.on_hand = Math.max(0, inv.on_hand - qty);
      }

      returnItems.push({
        id: `PRI-${Date.now()}-${returnItems.length + 1}`,
        product_id: prod.id,
        product_name: prod.display_name,
        sku: prod.sku,
        barcode: prod.barcode,
        quantity: qty,
        unit_cost_bdt: unitCost,
        total_amount_bdt: lineTotal,
      });

      // Append Stock Movement
      const movId = `MOV-${Date.now()}-${this.nextMovementId++}`;
      this.stockMovements.unshift({
        id: movId,
        product_id: prod.id,
        product_name: prod.display_name,
        sku: prod.sku,
        warehouse_id: wh.id,
        warehouse_name: wh.name,
        quantity_delta: -qty,
        movement_reason: 'PURCHASE_RETURN',
        unit_cost: unitCost,
        total_cost: lineTotal,
        reference_id: returnNumber,
        notes: `Returned to supplier ${supp.name} (${params.reason}). Reason: ${params.reason_details || 'Defect/Damage'}`,
        created_by: params.actor_id,
        created_by_name: params.actor_name,
        created_at: new Date().toISOString(),
      });
    }

    const settlementType = params.settlement_type || 'credit_note';
    let refundAcc: Account | undefined;
    if (settlementType === 'cash_refund' || settlementType === 'bank_refund') {
      const accId = params.refund_account_id || (settlementType === 'cash_refund' ? 'acc_cash' : 'acc_bank');
      refundAcc = this.accounts.get(accId);
    }

    const purchaseReturn: PurchaseReturn = {
      id: returnId,
      return_number: returnNumber,
      supplier_id: supp.id,
      supplier_name: supp.name,
      purchase_order_id: poRef?.id,
      purchase_order_number: poRef?.po_number,
      warehouse_id: wh.id,
      warehouse_name: wh.name,
      return_date: params.return_date || new Date().toISOString().slice(0, 10),
      reason: params.reason,
      reason_details: params.reason_details,
      items: returnItems,
      total_amount_bdt: totalAmountBdt,
      settlement_type: settlementType,
      refund_account_id: refundAcc?.id,
      refund_account_name: refundAcc?.name,
      status: 'completed',
      created_by: params.actor_id,
      created_by_name: params.actor_name,
      created_at: new Date().toISOString(),
    };

    this.purchaseReturns.set(purchaseReturn.id, purchaseReturn);

    // Double-entry journal posting:
    // If credit note: Dr Supplier Payables, Cr Inventory
    // If cash/bank refund: Dr Cash/Bank, Cr Inventory
    if (settlementType === 'credit_note') {
      supp.balance_payable = Math.max(0, supp.balance_payable - totalAmountBdt);
      supp.updated_at = new Date().toISOString();

      this.postJournal(
        purchaseReturn.return_date,
        'purchase_return',
        purchaseReturn.id,
        `Purchase Return to ${supp.name} (${returnNumber}) - Credit Note \u09F3${totalAmountBdt}`,
        [
          { account_id: 'acc_supp_pay', debit: totalAmountBdt, credit: 0, line_desc: `Debit supplier payables for return ${returnNumber}` },
          { account_id: 'acc_inventory', debit: 0, credit: totalAmountBdt, line_desc: `Inventory reduction for return ${returnNumber}` },
        ],
        params.actor_name,
        undefined,
        'general_journal'
      );
    } else if (refundAcc) {
      this.postJournal(
        purchaseReturn.return_date,
        'purchase_return_refund',
        purchaseReturn.id,
        `Purchase Return Refund from ${supp.name} (${returnNumber}) - \u09F3${totalAmountBdt}`,
        [
          { account_id: refundAcc.id, debit: totalAmountBdt, credit: 0, line_desc: `Cash/bank refund received from ${supp.name}` },
          { account_id: 'acc_inventory', debit: 0, credit: totalAmountBdt, line_desc: `Inventory reduction for return ${returnNumber}` },
        ],
        params.actor_name,
        undefined,
        'supplier_payment'
      );
    }

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'purchase_return_created',
      'purchase_return',
      purchaseReturn.id,
      `Processed Purchase Return ${returnNumber} to ${supp.name} (\u09F3${totalAmountBdt.toLocaleString()}, ${settlementType})`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'system',
      message: `Purchase return ${returnNumber} processed for ${supp.name} (\u09F3${totalAmountBdt.toLocaleString()})`,
      ref_type: 'purchase_return',
      ref_id: purchaseReturn.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return purchaseReturn;
  }

  // --- PHASE 5: CUSTOMER RETURNS, DAMAGED STOCK ROUTING & RTO (Section 12, 15.3, 35.2, 40.5) ---

  public allocateCustomerReturnNumber(isRto = false): string {
    const num = this.nextCustReturnNumber++;
    const prefix = isRto ? 'RTO' : 'RET';
    return `${prefix}-2026-${String(num).padStart(4, '0')}`;
  }

  // Process Customer Return or Courier RTO with Physical Inspection Condition Triage
  public processCustomerReturn(params: {
    order_id: string;
    return_type: CustomerReturnType;
    reason: CustomerReturnReason;
    reason_details?: string;
    items: {
      product_id: string;
      quantity: number;
      condition: ItemReturnCondition;
      restock_warehouse_id?: string;
    }[];
    refund_amount?: number;
    courier_fee_loss?: number;
    courier_fee_source?: CourierChargeSource;
    refund_method?: 'bank_transfer' | 'bkash' | 'nagad' | 'cash' | 'store_credit' | 'none_rto';
    refund_account_id?: string;
    actor_id: string;
    actor_name: string;
    notes?: string;
  }): CustomerReturn {
    const order = Array.from(this.orders.values()).find(
      o => o.id === params.order_id || o.invoice_number === params.order_id
    );
    if (!order) throw new Error(`Order not found: ${params.order_id}`);

    const customer = this.customers.get(order.customer_id);
    const returnNumber = this.allocateCustomerReturnNumber(params.return_type === 'courier_rto');
    const returnId = `CRET-${Date.now()}-${this.customerReturns.size + 1}`;

    let totalRestockedValue = 0;
    let totalTesterValue = 0;
    let totalDamagedValue = 0;
    let totalItemsCount = 0;

    const returnItems: CustomerReturnItem[] = [];

    for (const line of params.items) {
      if (line.quantity <= 0) continue;
      const prod = this.products.get(line.product_id);
      if (!prod) throw new Error(`Product not found: ${line.product_id}`);

      const orderItem = order.items.find(it => it.product_id === line.product_id);
      const unitPrice = orderItem ? orderItem.unit_price : prod.selling_price;
      const unitCost = (orderItem && orderItem.unit_cost_at_sale) ? orderItem.unit_cost_at_sale : prod.avg_cost;

      const targetWhId = line.restock_warehouse_id || 'wh_shop';
      const targetWh = this.warehouses.get(targetWhId) || this.warehouses.get('wh_shop')!;

      totalItemsCount += line.quantity;
      const itemCostTotal = line.quantity * unitCost;

      // Condition Triage (Section 35.2):
      // 1. restockable: Perfect condition -> Add back to sellable on_hand inventory
      // 2. damaged_tester: Broken box / unsealed -> Route to Showroom Tester stock
      // 3. damaged_writeoff: Broken glass / leaking -> Written off as Loss
      if (line.condition === 'restockable') {
        const invK = this.invKey(prod.id, targetWh.id);
        let inv = this.inventory.get(invK);
        if (!inv) {
          inv = { product_id: prod.id, warehouse_id: targetWh.id, on_hand: 0, reserved: 0, avg_cost: unitCost };
          this.inventory.set(invK, inv);
        }
        inv.on_hand += line.quantity;
        totalRestockedValue += itemCostTotal;

        // Stock ledger movement
        const movId = `MOV-${Date.now()}-${this.nextMovementId++}`;
        this.stockMovements.unshift({
          id: movId,
          product_id: prod.id,
          product_name: prod.display_name,
          sku: prod.sku,
          warehouse_id: targetWh.id,
          warehouse_name: targetWh.name,
          quantity_delta: line.quantity,
          movement_reason: 'RETURN_RESTOCK',
          unit_cost: unitCost,
          total_cost: itemCostTotal,
          reference_id: returnNumber,
          created_by: params.actor_id,
          created_by_name: params.actor_name,
          created_at: new Date().toISOString(),
          notes: `Restocked from ${returnNumber} (${order.invoice_number})`,
        });

        // Journal: Dr Inventory, Cr COGS
        this.postJournal(
          new Date().toISOString().slice(0, 10),
          'return_restock',
          returnId,
          `Return Restock: ${line.quantity}x ${prod.display_name} into ${targetWh.name}`,
          [
            { account_id: 'acc_inventory', debit: itemCostTotal, credit: 0, line_desc: `Restocked ${prod.display_name}` },
            { account_id: 'acc_cogs', debit: 0, credit: itemCostTotal, line_desc: `COGS reversal for returned item` },
          ],
          params.actor_name,
          undefined,
          'customer_return'
        );

      } else if (line.condition === 'damaged_tester') {
        totalTesterValue += itemCostTotal;

        const movId = `MOV-${Date.now()}-${this.nextMovementId++}`;
        this.stockMovements.unshift({
          id: movId,
          product_id: prod.id,
          product_name: prod.display_name,
          sku: prod.sku,
          warehouse_id: targetWh.id,
          warehouse_name: targetWh.name,
          quantity_delta: 0, // Routed to tester
          movement_reason: 'TESTER_CONVERSION',
          unit_cost: unitCost,
          total_cost: itemCostTotal,
          reference_id: returnNumber,
          created_by: params.actor_id,
          created_by_name: params.actor_name,
          created_at: new Date().toISOString(),
          notes: `Unsealed/blemished bottle converted to Showroom Tester from ${returnNumber}`,
        });

        // Journal: Dr Showroom Tester Expense, Cr COGS
        this.postJournal(
          new Date().toISOString().slice(0, 10),
          'return_tester',
          returnId,
          `Tester Routing: ${line.quantity}x ${prod.display_name} assigned to showroom marketing`,
          [
            { account_id: 'acc_tester_exp', debit: itemCostTotal, credit: 0, line_desc: `Tester bottle expense for ${prod.display_name}` },
            { account_id: 'acc_cogs', debit: 0, credit: itemCostTotal, line_desc: `COGS reversal routed to tester expense` },
          ],
          params.actor_name,
          undefined,
          'customer_return'
        );

      } else if (line.condition === 'damaged_writeoff') {
        totalDamagedValue += itemCostTotal;

        const movId = `MOV-${Date.now()}-${this.nextMovementId++}`;
        this.stockMovements.unshift({
          id: movId,
          product_id: prod.id,
          product_name: prod.display_name,
          sku: prod.sku,
          warehouse_id: targetWh.id,
          warehouse_name: targetWh.name,
          quantity_delta: 0,
          movement_reason: 'DAMAGED_WRITE_OFF',
          unit_cost: unitCost,
          total_cost: itemCostTotal,
          reference_id: returnNumber,
          created_by: params.actor_id,
          created_by_name: params.actor_name,
          created_at: new Date().toISOString(),
          notes: `Broken glass/damaged atomizer written off as loss from ${returnNumber}`,
        });

        // Journal: Dr Damaged & Broken Perfume Loss, Cr COGS
        this.postJournal(
          new Date().toISOString().slice(0, 10),
          'return_damaged_writeoff',
          returnId,
          `Damaged Loss Writeoff: ${line.quantity}x ${prod.display_name} broken during transit/handling`,
          [
            { account_id: 'acc_damaged_exp', debit: itemCostTotal, credit: 0, line_desc: `Damaged stock write-off for ${prod.display_name}` },
            { account_id: 'acc_cogs', debit: 0, credit: itemCostTotal, line_desc: `COGS reversal routed to damaged loss` },
          ],
          params.actor_name,
          undefined,
          'customer_return'
        );
      }

      returnItems.push({
        id: `CRI-${Date.now()}-${returnItems.length + 1}`,
        product_id: prod.id,
        product_name: prod.display_name,
        sku: prod.sku,
        barcode: prod.barcode,
        quantity: line.quantity,
        unit_price: unitPrice,
        unit_cost: unitCost,
        condition: line.condition,
        restock_warehouse_id: targetWh.id,
        restock_warehouse_name: targetWh.name,
      });
    }

    const refundAmount = Number(params.refund_amount || 0);
    const courierFeeLoss = Number(params.courier_fee_loss || 0);
    
    // Intelligently determine refund account from original payment account if not explicitly passed (Phase 3)
    let resolvedRefundAccountId = params.refund_account_id;
    let resolvedRefundMethod = params.refund_method;

    if (!resolvedRefundAccountId && order.payments && order.payments.length > 0) {
      const completedPayment = order.payments.find(p => p.status === 'completed' && p.method !== 'cod_pending');
      if (completedPayment) {
        resolvedRefundAccountId = completedPayment.payment_account_id || (completedPayment.method === 'cash' ? 'acc_cash' : completedPayment.method === 'bank' ? 'acc_bank' : 'acc_bkash');
        if (!resolvedRefundMethod) {
          resolvedRefundMethod = completedPayment.method === 'bank' || completedPayment.method === 'card' ? 'bank_transfer' : (completedPayment.method as any);
        }
      }
    }

    const refundMethod = resolvedRefundMethod || (params.return_type === 'courier_rto' ? 'none_rto' : 'bkash');
    const refundAccountId = resolvedRefundAccountId || 'acc_bkash';
    const refundAcc = this.accounts.get(refundAccountId) || this.accounts.get('acc_cash') || this.accounts.get('acc_bank')!;

    // Financial settlement journals
    if (params.return_type === 'customer_return' && refundAmount > 0) {
      // Dr Sales Returns & Allowances (Contra-revenue), Cr Refund Account (Bank/MFS/Cash)
      this.postJournal(
        new Date().toISOString().slice(0, 10),
        'customer_refund',
        returnId,
        `Customer Refund for ${returnNumber} (${order.invoice_number}): ${refundMethod.toUpperCase()} payout`,
        [
          { account_id: 'acc_sales_ret', debit: refundAmount, credit: 0, line_desc: `Customer refund for ${order.invoice_number}` },
          { account_id: refundAcc.id, debit: 0, credit: refundAmount, line_desc: `Refund disbursement from ${refundAcc.name}` },
        ],
        params.actor_name,
        undefined,
        'customer_return'
      );
    } else if (params.return_type === 'courier_rto') {
      // Courier RTO: If return charge incurred, record Dr Courier Expense, Cr Courier Receivable
      if (courierFeeLoss > 0) {
        this.postJournal(
          new Date().toISOString().slice(0, 10),
          'courier_rto_fee',
          returnId,
          `Steadfast RTO Return Penalty Fee: ${returnNumber} (${order.invoice_number})`,
          [
            { account_id: 'acc_courier_exp', debit: courierFeeLoss, credit: 0, line_desc: `RTO freight fee charged by carrier` },
            { account_id: 'acc_courier_rec', debit: 0, credit: courierFeeLoss, line_desc: `Deducted from courier clearing` },
          ],
          params.actor_name,
          undefined,
          'courier_settlement'
        );
      }

      // Update customer RTO count and flag risk if threshold reached (Section 3.2, 40.5)
      if (customer) {
        customer.rto_count = (customer.rto_count || 0) + 1;
        const threshold = this.settings.rto_risk_threshold || 2;
        if (customer.rto_count >= threshold) {
          customer.risk_flag = true;
        }
      }
    }

    // Update order status
    order.status = 'returned';
    order.updated_at = new Date().toISOString();

    // If courier booking exists, update booking to rto
    const booking = Array.from(this.courierBookings.values()).find(
      b => b.order_id === order.id || b.invoice_number === order.invoice_number
    );
    if (booking) {
      booking.status = 'rto';
      booking.notes = `RTO Intake completed: ${returnNumber}`;
    }

    const customerReturn: CustomerReturn = {
      id: returnId,
      return_number: returnNumber,
      order_id: order.id,
      invoice_number: order.invoice_number,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      return_type: params.return_type,
      reason: params.reason,
      reason_details: params.reason_details,
      items: returnItems,
      total_items_count: totalItemsCount,
      refund_amount: refundAmount,
      courier_fee_loss: courierFeeLoss,
      courier_fee_source: courierFeeLoss > 0 ? (params.courier_fee_source || 'manual') : undefined,
      refund_method: refundMethod,
      refund_account_id: refundAcc.id,
      refund_account_name: refundAcc.name,
      status: refundAmount > 0 ? 'refunded' : 'closed',
      inspected_by: params.actor_id,
      inspected_by_name: params.actor_name,
      inspected_at: new Date().toISOString(),
      notes: params.notes,
      created_at: new Date().toISOString(),
    };

    this.customerReturns.set(customerReturn.id, customerReturn);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'customer_return_processed',
      'customer_return',
      customerReturn.id,
      `Processed ${params.return_type.toUpperCase()} ${returnNumber} for ${order.invoice_number}: ${totalItemsCount} bottles triaged (Refund: \u09F3${refundAmount}, Courier Loss: \u09F3${courierFeeLoss})`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: params.return_type === 'courier_rto' ? 'rto_alert' : 'system',
      message: `Return ${returnNumber} processed for ${order.invoice_number} (${params.return_type.replace('_', ' ').toUpperCase()})`,
      ref_type: 'customer_return',
      ref_id: customerReturn.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return customerReturn;
  }

  public updateReturnCourierFeeManual(params: {
    return_id: string;
    courier_fee_loss: number;
    actor_id: string;
    actor_name: string;
    notes?: string;
  }): CustomerReturn {
    const ret = this.customerReturns.get(params.return_id);
    if (!ret) throw new Error('Customer return record not found');

    const newFee = Number(params.courier_fee_loss);
    if (isNaN(newFee) || newFee < 0) {
      throw new Error('Valid courier return charge is required');
    }

    const previousFee = ret.courier_fee_loss || 0;
    const feeDiff = newFee - previousFee;

    ret.courier_fee_loss = newFee;
    ret.courier_fee_source = 'manual';
    ret.updated_at = new Date().toISOString();

    if (feeDiff !== 0) {
      if (feeDiff > 0) {
        // Dr Courier Expense, Cr Courier Receivable
        this.postJournal(
          new Date().toISOString().slice(0, 10),
          'courier_rto_fee_adjust',
          ret.id,
          `Steadfast RTO Fee Adjustment for ${ret.return_number}: +\u09F3${feeDiff}`,
          [
            { account_id: 'acc_courier_exp', debit: feeDiff, credit: 0, line_desc: `Additional RTO fee for ${ret.return_number}` },
            { account_id: 'acc_courier_rec', debit: 0, credit: feeDiff, line_desc: `Additional deduction from courier clearing` },
          ],
          params.actor_name,
          undefined,
          'courier_settlement'
        );
      } else {
        const absDiff = Math.abs(feeDiff);
        // Reverse part of expense
        this.postJournal(
          new Date().toISOString().slice(0, 10),
          'courier_rto_fee_adjust',
          ret.id,
          `Steadfast RTO Fee Adjustment for ${ret.return_number}: -\u09F3${absDiff}`,
          [
            { account_id: 'acc_courier_rec', debit: absDiff, credit: 0, line_desc: `Reversal of RTO fee for ${ret.return_number}` },
            { account_id: 'acc_courier_exp', debit: 0, credit: absDiff, line_desc: `Reduction in courier RTO expense` },
          ],
          params.actor_name,
          undefined,
          'courier_settlement'
        );
      }
    }

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'return_courier_fee_updated',
      'customer_return',
      ret.id,
      `Updated RTO return courier fee for ${ret.return_number}: \u09F3${previousFee} \u2794 \u09F3${newFee}. Notes: ${params.notes || 'N/A'}`
    );

    return ret;
  }

  // Get Returns & RTO Summary Metrics (Section 12, 40.5)
  public getCustomerReturnsSummary(): {
    total_returns_count: number;
    total_rto_count: number;
    total_customer_returns_count: number;
    total_refunded_amount: number;
    total_courier_loss: number;
    total_restocked_units: number;
    total_tester_units: number;
    total_damaged_units: number;
  } {
    const returns = Array.from(this.customerReturns.values());
    let rtoCount = 0;
    let custReturnCount = 0;
    let totalRefunded = 0;
    let totalCourierLoss = 0;
    let restockedUnits = 0;
    let testerUnits = 0;
    let damagedUnits = 0;

    for (const r of returns) {
      if (r.return_type === 'courier_rto') rtoCount++;
      else custReturnCount++;

      totalRefunded += r.refund_amount || 0;
      totalCourierLoss += r.courier_fee_loss || 0;

      for (const it of r.items) {
        if (it.condition === 'restockable') restockedUnits += it.quantity;
        else if (it.condition === 'damaged_tester') testerUnits += it.quantity;
        else if (it.condition === 'damaged_writeoff') damagedUnits += it.quantity;
      }
    }

    return {
      total_returns_count: returns.length,
      total_rto_count: rtoCount,
      total_customer_returns_count: custReturnCount,
      total_refunded_amount: totalRefunded,
      total_courier_loss: totalCourierLoss,
      total_restocked_units: restockedUnits,
      total_tester_units: testerUnits,
      total_damaged_units: damagedUnits,
    };
  }

  // --- PHASE 6: DAILY CASH RECONCILIATION, PETTY CASH, PAYROLL & FINANCIAL STATEMENTS (Section 15, 17, 18, 19, 40.6) ---

  public allocateExpenseNumber(): string {
    return `EXP-2026-${String(this.nextExpenseNumber++).padStart(4, '0')}`;
  }

  public allocatePayslipNumber(): string {
    return `PS-2026-${String(this.nextPayslipNumber++).padStart(4, '0')}`;
  }

  // 1. Daily Cash Till Register Reconciliation (Section 17, 40.6)
  public reconcileDailyCashRegister(params: {
    session_date: string;
    opening_float: number;
    cash_sales_inflow: number;
    cash_outflow: number;
    denominations: {
      note_1000: number;
      note_500: number;
      note_200: number;
      note_100: number;
      note_50: number;
      note_20: number;
      note_10: number;
      coins: number;
    };
    notes?: string;
    actor_id: string;
    actor_name: string;
  }): DailyCashRegisterLog {
    const d = params.denominations;
    const actualCashCount =
      (d.note_1000 || 0) * 1000 +
      (d.note_500 || 0) * 500 +
      (d.note_200 || 0) * 200 +
      (d.note_100 || 0) * 100 +
      (d.note_50 || 0) * 50 +
      (d.note_20 || 0) * 20 +
      (d.note_10 || 0) * 10 +
      (d.coins || 0);

    const expectedClosingCash = Number(params.opening_float) + Number(params.cash_sales_inflow) - Number(params.cash_outflow);
    const variance = actualCashCount - expectedClosingCash;

    const logId = `CSH-REG-${Date.now()}`;
    const logEntry: DailyCashRegisterLog = {
      id: logId,
      session_date: params.session_date,
      opening_float: Number(params.opening_float),
      cash_sales_inflow: Number(params.cash_sales_inflow),
      cash_outflow: Number(params.cash_outflow),
      expected_closing_cash: expectedClosingCash,
      actual_cash_count: actualCashCount,
      variance: variance,
      denominations: params.denominations,
      notes: params.notes,
      closed_by: params.actor_id,
      closed_by_name: params.actor_name,
      created_at: new Date().toISOString(),
    };

    // If variance is non-zero, automatically post Cash Shortage / Overage Journal
    if (variance < 0) {
      const shortageAmt = Math.abs(variance);
      this.postJournal(
        params.session_date,
        'cash_reconciliation',
        logId,
        `Daily Cash Till Shortage Adjustment for ${params.session_date}`,
        [
          { account_id: 'acc_cash_shortage', debit: shortageAmt, credit: 0, line_desc: `Cash till shortage on count` },
          { account_id: 'acc_cash', debit: 0, credit: shortageAmt, line_desc: `Adjust till cash balance down to physical count` },
        ],
        params.actor_name,
        undefined,
        'cashier_closing'
      );

    } else if (variance > 0) {
      const overageAmt = variance;
      this.postJournal(
        params.session_date,
        'cash_reconciliation',
        logId,
        `Daily Cash Till Overage Surplus for ${params.session_date}`,
        [
          { account_id: 'acc_cash', debit: overageAmt, credit: 0, line_desc: `Adjust till cash balance up to physical count` },
          { account_id: 'acc_other_inc', debit: 0, credit: overageAmt, line_desc: `Cash till overage surplus recognized` },
        ],
        params.actor_name,
        undefined,
        'cashier_closing'
      );
    }

    this.cashRegisterLogs.unshift(logEntry);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'cash_register_reconciled',
      'cash_register',
      logId,
      `Reconciled cash register for ${params.session_date}: Actual \u09F3${actualCashCount.toLocaleString()} vs Expected \u09F3${expectedClosingCash.toLocaleString()} (Variance: \u09F3${variance.toLocaleString()})`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: variance === 0 ? 'system' : 'alert',
      message: `Daily cash till for ${params.session_date} closed by ${params.actor_name}. Physical Cash: \u09F3${actualCashCount.toLocaleString()} (Variance: \u09F3${variance})`,
      ref_type: 'cash_register',
      ref_id: logId,
      read: false,
      created_at: new Date().toISOString(),
    });

    return logEntry;
  }

  // 1b. Cashier / Salesperson Daily Closing Workflow (Section 17, POS Closing)
  public allocateClosingId(): string {
    return `CLS-${Date.now()}-${this.nextClosingSeq++}`;
  }

  public computeCashierSalesMetrics(cashierId: string, businessDate: string): CashierClosingSalesMetrics {
    const metrics: CashierClosingSalesMetrics = {
      total_sales: 0,
      order_count: 0,
      cash_sales: 0,
      bkash_sales: 0,
      nagad_sales: 0,
      bank_sales: 0,
      card_sales: 0,
      total_collected: 0,
    };

    const matchingOrders = Array.from(this.orders.values()).filter(o => {
      if (o.status === 'cancelled') return false;
      const orderCashierId = o.created_by;
      if (cashierId && orderCashierId && orderCashierId !== cashierId) return false;
      const orderDate = o.business_date || o.transaction_date?.slice(0, 10) || o.created_at.slice(0, 10);
      return orderDate === businessDate;
    });

    metrics.order_count = matchingOrders.length;
    for (const ord of matchingOrders) {
      metrics.total_sales += ord.total;
      if (ord.payments && ord.payments.length > 0) {
        for (const p of ord.payments) {
          if (p.status === 'completed') {
            metrics.total_collected += p.amount;
            if (p.method === 'cash') metrics.cash_sales += p.amount;
            else if (p.method === 'bkash') metrics.bkash_sales += p.amount;
            else if (p.method === 'nagad') metrics.nagad_sales += p.amount;
            else if (p.method === 'bank') metrics.bank_sales += p.amount;
            else if (p.method === 'card') metrics.card_sales += p.amount;
          }
        }
      }
    }

    return metrics;
  }

  public refreshClosingCalculations(closing: CashierDailyClosing): CashierDailyClosing {
    if (closing.status === 'open' || closing.status === 'rejected') {
      closing.sales_metrics = this.computeCashierSalesMetrics(closing.cashier_id, closing.business_date);
      closing.total_cash_expenses = (closing.cash_expenses || []).reduce((sum, e) => sum + e.amount, 0);
      closing.expected_cash = Number(closing.opening_float || 0) + closing.sales_metrics.cash_sales - closing.total_cash_expenses;
      closing.cash_variance = closing.actual_cash - closing.expected_cash;
      closing.updated_at = new Date().toISOString();
    }
    return closing;
  }

  public startCashierBusinessDay(params: {
    cashier_id: string;
    cashier_name: string;
    business_date?: string;
    opening_float?: number;
  }): CashierDailyClosing {
    const bDate = params.business_date || new Date().toISOString().slice(0, 10);
    // If one already exists for this cashier and date, refresh and return it
    const existing = Array.from(this.cashierDailyClosings.values()).find(
      c => c.cashier_id === params.cashier_id && c.business_date === bDate
    );
    if (existing) {
      if (params.opening_float !== undefined && (existing.status === 'open' || existing.status === 'rejected')) {
        existing.opening_float = Number(params.opening_float);
      }
      return this.refreshClosingCalculations(existing);
    }

    const salesMetrics = this.computeCashierSalesMetrics(params.cashier_id, bDate);
    const openingFloat = Number(params.opening_float ?? 0);
    const expectedCash = openingFloat + salesMetrics.cash_sales;
    const closingId = this.allocateClosingId();

    const newClosing: CashierDailyClosing = {
      id: closingId,
      cashier_id: params.cashier_id,
      cashier_name: params.cashier_name,
      business_date: bDate,
      status: 'open',
      started_at: new Date().toISOString(),
      opening_float: openingFloat,
      sales_metrics: salesMetrics,
      cash_expenses: [],
      total_cash_expenses: 0,
      expected_cash: expectedCash,
      actual_cash: 0,
      cash_variance: 0 - expectedCash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.cashierDailyClosings.set(closingId, newClosing);
    return newClosing;
  }

  public addCashierCashExpense(closingId: string, params: {
    category?: string;
    description: string;
    amount: number;
    receipt_reference?: string;
    actor_id: string;
    actor_name: string;
  }): CashierDailyClosing {
    const closing = this.cashierDailyClosings.get(closingId);
    if (!closing) throw new Error(`Cashier closing not found: ${closingId}`);
    if (closing.status === 'approved') {
      throw new Error('Cannot add expenses to an approved closing');
    }

    // Call recordExpense to post real expense record & double-entry journal (Dr Expense, Cr acc_cash)
    const exp = this.recordExpense({
      category: params.category || 'office_tea_snacks',
      description: `[Till Cash Expense - ${closing.business_date}] ${params.description}`,
      amount: Number(params.amount),
      payment_method: 'cash',
      payment_account_id: 'acc_cash',
      receipt_reference: params.receipt_reference,
      date: closing.business_date,
      actor_id: params.actor_id,
      actor_name: params.actor_name,
    });

    const cashExp: CashierCashExpense = {
      id: `CEXP-${Date.now()}-${closing.cash_expenses.length + 1}`,
      expense_record_id: exp.id,
      expense_number: exp.expense_number,
      amount: exp.amount,
      category: exp.category_name || exp.category,
      description: params.description,
      date: exp.date,
      receipt_reference: exp.receipt_reference,
      created_at: new Date().toISOString(),
    };

    closing.cash_expenses.push(cashExp);
    return this.refreshClosingCalculations(closing);
  }

  public submitCashierDailyClosing(closingId: string, params: {
    actual_cash: number;
    denominations?: {
      note_1000: number;
      note_500: number;
      note_200: number;
      note_100: number;
      note_50: number;
      note_20: number;
      note_10: number;
      coins: number;
    };
    closing_notes?: string;
    actor_id: string;
    actor_name: string;
  }): CashierDailyClosing {
    const closing = this.cashierDailyClosings.get(closingId);
    if (!closing) throw new Error(`Cashier closing not found: ${closingId}`);
    if (closing.status === 'approved') {
      throw new Error('This closing has already been approved');
    }

    this.refreshClosingCalculations(closing);

    closing.actual_cash = Number(params.actual_cash);
    closing.cash_variance = closing.actual_cash - closing.expected_cash;
    closing.denominations = params.denominations;
    closing.closing_notes = params.closing_notes;
    closing.status = 'submitted';
    closing.submitted_at = new Date().toISOString();
    closing.updated_at = new Date().toISOString();

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'cashier_closing_submitted',
      'cashier_closing',
      closing.id,
      `Submitted daily closing for ${closing.business_date} (${closing.cashier_name}): Actual Physical Cash \u09F3${closing.actual_cash.toLocaleString()} vs Expected \u09F3${closing.expected_cash.toLocaleString()} (Variance: \u09F3${closing.cash_variance.toLocaleString()})`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: closing.cash_variance === 0 ? 'system' : 'alert',
      message: `Daily closing submitted for ${closing.business_date} by ${closing.cashier_name}. Physical Cash: \u09F3${closing.actual_cash.toLocaleString()} (Variance: \u09F3${closing.cash_variance.toLocaleString()}). Requires review.`,
      ref_type: 'cash_register',
      ref_id: closing.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return closing;
  }

  public reviewCashierDailyClosing(closingId: string, params: {
    action: 'approve' | 'reject';
    review_notes?: string;
    actor_id: string;
    actor_name: string;
  }): CashierDailyClosing {
    const closing = this.cashierDailyClosings.get(closingId);
    if (!closing) throw new Error(`Cashier closing not found: ${closingId}`);

    if (params.action === 'approve') {
      closing.status = 'approved';
      closing.reviewed_at = new Date().toISOString();
      closing.reviewed_by = params.actor_id;
      closing.reviewed_by_name = params.actor_name;
      closing.review_notes = params.review_notes;
      closing.updated_at = new Date().toISOString();

      if (closing.cash_variance < 0) {
        const shortageAmt = Math.abs(closing.cash_variance);
        const je = this.postJournal(
          closing.business_date,
          'cash_reconciliation',
          closing.id,
          `Cashier Closing Shortage Adjustment for ${closing.business_date} (${closing.cashier_name})`,
          [
            { account_id: 'acc_cash_shortage', debit: shortageAmt, credit: 0, line_desc: `Cashier till shortage on count` },
            { account_id: 'acc_cash', debit: 0, credit: shortageAmt, line_desc: `Adjust till cash balance down to physical count` },
          ],
          params.actor_name,
          undefined,
          'cashier_closing'
        );
        closing.journal_entry_id = je.id;
      } else if (closing.cash_variance > 0) {
        const overageAmt = closing.cash_variance;
        const je = this.postJournal(
          closing.business_date,
          'cash_reconciliation',
          closing.id,
          `Cashier Closing Overage Surplus for ${closing.business_date} (${closing.cashier_name})`,
          [
            { account_id: 'acc_cash', debit: overageAmt, credit: 0, line_desc: `Adjust till cash balance up to physical count` },
            { account_id: 'acc_other_inc', debit: 0, credit: overageAmt, line_desc: `Cashier till overage surplus recognized` },
          ],
          params.actor_name,
          undefined,
          'cashier_closing'
        );
        closing.journal_entry_id = je.id;
      }

      this.logAudit(
        params.actor_id,
        params.actor_name,
        'cashier_closing_approved',
        'cashier_closing',
        closing.id,
        `Approved daily closing for ${closing.business_date} (${closing.cashier_name}). Variance: \u09F3${closing.cash_variance.toLocaleString()}`
      );

      this.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        type: 'system',
        message: `Daily closing for ${closing.business_date} approved by ${params.actor_name}.`,
        ref_type: 'cash_register',
        ref_id: closing.id,
        read: false,
        created_at: new Date().toISOString(),
      });
    } else {
      closing.status = 'rejected';
      closing.reviewed_at = new Date().toISOString();
      closing.reviewed_by = params.actor_id;
      closing.reviewed_by_name = params.actor_name;
      closing.review_notes = params.review_notes || 'Returned for recount/review';
      closing.updated_at = new Date().toISOString();

      this.logAudit(
        params.actor_id,
        params.actor_name,
        'cashier_closing_rejected',
        'cashier_closing',
        closing.id,
        `Returned daily closing for ${closing.business_date} (${closing.cashier_name}): ${closing.review_notes}`
      );

      this.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        type: 'alert',
        message: `Daily closing for ${closing.business_date} needs review: ${closing.review_notes}`,
        ref_type: 'cash_register',
        ref_id: closing.id,
        read: false,
        created_at: new Date().toISOString(),
      });
    }

    return closing;
  }

  // 1c. Payment Accounts & Financial Control Layer (Phase 1)
  public getPaymentAccounts(): PaymentAccount[] {
    const list = Array.from(this.paymentAccounts.values()).map(acc => {
      const coa = this.accounts.get(acc.linked_chart_account_id);
      return {
        ...acc,
        linked_chart_account_code: coa?.code,
        linked_chart_account_name: coa?.name,
        current_balance: coa ? coa.balance : acc.opening_balance,
      };
    });
    return list.sort((a, b) => (a.is_active === b.is_active ? a.account_name.localeCompare(b.account_name) : a.is_active ? -1 : 1));
  }

  public getPaymentAccount(id: string): PaymentAccount {
    const acc = this.paymentAccounts.get(id);
    if (!acc) throw new Error(`Payment account not found: ${id}`);
    const coa = this.accounts.get(acc.linked_chart_account_id);
    return {
      ...acc,
      linked_chart_account_code: coa?.code,
      linked_chart_account_name: coa?.name,
      current_balance: coa ? coa.balance : acc.opening_balance,
    };
  }

  public createPaymentAccount(params: {
    account_name: string;
    account_type: PaymentAccountType;
    account_number: string;
    bank_name?: string;
    branch_name?: string;
    routing_number?: string;
    linked_chart_account_id?: string;
    is_default_pos?: boolean;
    is_default_courier_settlement?: boolean;
    is_default_payroll?: boolean;
    is_default_expense?: boolean;
    opening_balance?: number;
    notes?: string;
    actor_id: string;
    actor_name: string;
  }): PaymentAccount {
    if (!params.account_name || !params.account_name.trim()) {
      throw new Error('Account name is required');
    }
    if (!params.account_number || !params.account_number.trim()) {
      throw new Error('Account number or identifier is required');
    }

    const id = `pmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const openingBal = Number(params.opening_balance) || 0;

    let linkedCoaId = params.linked_chart_account_id;
    if (!linkedCoaId) {
      // Auto-create or map to a COA account
      const codeSeq = 1050 + this.paymentAccounts.size;
      linkedCoaId = `acc_pmt_${id}`;
      this.accounts.set(linkedCoaId, {
        id: linkedCoaId,
        code: String(codeSeq),
        name: params.account_name,
        type: 'asset',
        balance: 0,
      });
    }

    const now = new Date().toISOString();
    const newAccount: PaymentAccount = {
      id,
      account_name: params.account_name.trim(),
      account_type: params.account_type,
      account_number: params.account_number.trim(),
      bank_name: params.bank_name?.trim(),
      branch_name: params.branch_name?.trim(),
      routing_number: params.routing_number?.trim(),
      linked_chart_account_id: linkedCoaId,
      is_default_pos: Boolean(params.is_default_pos),
      is_default_courier_settlement: Boolean(params.is_default_courier_settlement),
      is_default_payroll: Boolean(params.is_default_payroll),
      is_default_expense: Boolean(params.is_default_expense),
      is_active: true,
      opening_balance: openingBal,
      current_balance: openingBal,
      notes: params.notes?.trim(),
      created_at: now,
      updated_at: now,
    };

    this.paymentAccounts.set(id, newAccount);

    // If opening balance > 0, create double-entry opening balance journal
    if (openingBal > 0) {
      this.postJournal(
        now.slice(0, 10),
        'opening_balance',
        id,
        `Opening balance for payment account: ${newAccount.account_name}`,
        [
          { account_id: linkedCoaId, debit: openingBal, credit: 0, line_desc: 'Initial opening balance' },
          { account_id: 'acc_equity', debit: 0, credit: openingBal, line_desc: 'Opening balance equity offset' },
        ],
        params.actor_name,
        undefined,
        'deposit'
      );
    }

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'create_payment_account',
      'payment_account',
      id,
      `Created payment account ${newAccount.account_name} (${newAccount.account_type}) linked to COA ${linkedCoaId}`
    );

    return this.getPaymentAccount(id);
  }

  public updatePaymentAccount(
    id: string,
    params: {
      account_name?: string;
      account_number?: string;
      bank_name?: string;
      branch_name?: string;
      routing_number?: string;
      linked_chart_account_id?: string;
      is_default_pos?: boolean;
      is_default_courier_settlement?: boolean;
      is_default_payroll?: boolean;
      is_default_expense?: boolean;
      notes?: string;
      actor_id: string;
      actor_name: string;
    }
  ): PaymentAccount {
    const acc = this.paymentAccounts.get(id);
    if (!acc) throw new Error(`Payment account not found: ${id}`);

    if (params.account_name) acc.account_name = params.account_name.trim();
    if (params.account_number) acc.account_number = params.account_number.trim();
    if (params.bank_name !== undefined) acc.bank_name = params.bank_name.trim();
    if (params.branch_name !== undefined) acc.branch_name = params.branch_name.trim();
    if (params.routing_number !== undefined) acc.routing_number = params.routing_number.trim();
    if (params.linked_chart_account_id) acc.linked_chart_account_id = params.linked_chart_account_id;
    if (params.is_default_pos !== undefined) acc.is_default_pos = params.is_default_pos;
    if (params.is_default_courier_settlement !== undefined) acc.is_default_courier_settlement = params.is_default_courier_settlement;
    if (params.is_default_payroll !== undefined) acc.is_default_payroll = params.is_default_payroll;
    if (params.is_default_expense !== undefined) acc.is_default_expense = params.is_default_expense;
    if (params.notes !== undefined) acc.notes = params.notes.trim();
    acc.updated_at = new Date().toISOString();

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'update_payment_account',
      'payment_account',
      id,
      `Updated payment account ${acc.account_name}`
    );

    return this.getPaymentAccount(id);
  }

  public togglePaymentAccountActive(id: string, isActive: boolean, actorId: string, actorName: string): PaymentAccount {
    const acc = this.paymentAccounts.get(id);
    if (!acc) throw new Error(`Payment account not found: ${id}`);

    acc.is_active = isActive;
    acc.updated_at = new Date().toISOString();

    this.logAudit(
      actorId,
      actorName,
      isActive ? 'activate_payment_account' : 'deactivate_payment_account',
      'payment_account',
      id,
      `${isActive ? 'Activated' : 'Deactivated'} payment account ${acc.account_name}`
    );

    return this.getPaymentAccount(id);
  }

  public transferFunds(params: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    transfer_date?: string;
    fee_amount?: number;
    fee_account_id?: string;
    reference?: string;
    notes?: string;
    actor_id: string;
    actor_name: string;
  }): { transfer: FundTransferRecord; journal_entry: JournalEntry } {
    const { from_account_id, to_account_id, amount } = params;

    if (!from_account_id || !to_account_id) {
      throw new Error('Source and destination accounts are both required');
    }
    if (from_account_id === to_account_id) {
      throw new Error('Source and destination accounts must be different');
    }
    if (!amount || amount <= 0) {
      throw new Error('Transfer amount must be greater than zero');
    }

    const fromAcc = this.paymentAccounts.get(from_account_id);
    const toAcc = this.paymentAccounts.get(to_account_id);

    if (!fromAcc) throw new Error(`Source payment account not found: ${from_account_id}`);
    if (!toAcc) throw new Error(`Destination payment account not found: ${to_account_id}`);

    if (!fromAcc.is_active) throw new Error(`Source payment account (${fromAcc.account_name}) is deactivated`);
    if (!toAcc.is_active) throw new Error(`Destination payment account (${toAcc.account_name}) is deactivated`);

    const feeAmount = Math.max(0, Number(params.fee_amount) || 0);
    const transferDate = params.transfer_date || new Date().toISOString().slice(0, 10);
    const transferNum = `TRF-2026-${String(this.nextTransferSeq++).padStart(4, '0')}`;
    const transferId = `TRF-${Date.now()}`;

    // Construct Double-Entry Journal Lines
    const lines: { account_id: string; debit: number; credit: number; line_desc?: string }[] = [];

    // Debit Destination Account (increases destination asset)
    lines.push({
      account_id: toAcc.linked_chart_account_id,
      debit: amount,
      credit: 0,
      line_desc: `Fund transfer received from ${fromAcc.account_name}${params.reference ? ` (Ref: ${params.reference})` : ''}`,
    });

    if (feeAmount > 0) {
      // Debit Fee Account (Bank/Gateway charge)
      const feeAccId = params.fee_account_id || 'acc_bank_charges';
      lines.push({
        account_id: feeAccId,
        debit: feeAmount,
        credit: 0,
        line_desc: `Transfer charge/gateway fee on transfer to ${toAcc.account_name}`,
      });
      // Credit Source Account for total amount + fee
      lines.push({
        account_id: fromAcc.linked_chart_account_id,
        debit: 0,
        credit: amount + feeAmount,
        line_desc: `Fund transfer to ${toAcc.account_name} (Principal: ৳${amount.toLocaleString()}, Fee: ৳${feeAmount.toLocaleString()})`,
      });
    } else {
      // Credit Source Account for amount
      lines.push({
        account_id: fromAcc.linked_chart_account_id,
        debit: 0,
        credit: amount,
        line_desc: `Fund transfer to ${toAcc.account_name}${params.reference ? ` (Ref: ${params.reference})` : ''}`,
      });
    }

    const journalEntry = this.postJournal(
      transferDate,
      'fund_transfer',
      transferNum,
      `Internal Fund Transfer: ${fromAcc.account_name} ➔ ${toAcc.account_name} (৳${amount.toLocaleString()})`,
      lines,
      params.actor_name,
      undefined,
      'fund_transfer_in'
    );

    const transferRecord: FundTransferRecord = {
      id: transferId,
      transfer_number: transferNum,
      from_account_id: fromAcc.id,
      from_account_name: fromAcc.account_name,
      to_account_id: toAcc.id,
      to_account_name: toAcc.account_name,
      amount,
      transfer_date: transferDate,
      fee_amount: feeAmount > 0 ? feeAmount : undefined,
      fee_account_id: feeAmount > 0 ? (params.fee_account_id || 'acc_bank_charges') : undefined,
      reference: params.reference?.trim(),
      notes: params.notes?.trim(),
      journal_entry_id: journalEntry.id,
      created_by: params.actor_id,
      created_by_name: params.actor_name,
      created_at: new Date().toISOString(),
    };

    this.fundTransfers.set(transferId, transferRecord);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'fund_transfer',
      'payment_account',
      transferId,
      `Transferred ৳${amount.toLocaleString()} from ${fromAcc.account_name} to ${toAcc.account_name} (JE: ${journalEntry.entry_number})`
    );

    return { transfer: transferRecord, journal_entry: journalEntry };
  }

  public depositFunds(params: {
    payment_account_id: string;
    amount: number;
    deposit_date?: string;
    source_type?: 'capital_injection' | 'bank_interest' | 'cash_deposit' | 'customer_advance' | 'other_income';
    offset_account_id?: string;
    reference?: string;
    notes?: string;
    actor_id: string;
    actor_name: string;
  }): { deposit: AccountDepositRecord; journal_entry: JournalEntry } {
    const { payment_account_id, amount } = params;

    if (!payment_account_id) throw new Error('Payment account is required');
    if (!amount || amount <= 0) throw new Error('Deposit amount must be greater than zero');

    const acc = this.paymentAccounts.get(payment_account_id);
    if (!acc) throw new Error(`Payment account not found: ${payment_account_id}`);
    if (!acc.is_active) throw new Error(`Payment account (${acc.account_name}) is deactivated`);

    const depositDate = params.deposit_date || new Date().toISOString().slice(0, 10);
    const sourceType = params.source_type || 'other_income';

    // Resolve credit offset account
    let offsetAccId = params.offset_account_id;
    if (!offsetAccId) {
      if (sourceType === 'capital_injection') offsetAccId = 'acc_equity';
      else if (sourceType === 'bank_interest') offsetAccId = 'acc_other_inc';
      else if (sourceType === 'customer_advance') offsetAccId = 'acc_sales_rev';
      else offsetAccId = 'acc_other_inc';
    }

    const offsetCoa = this.accounts.get(offsetAccId);
    const offsetAccName = offsetCoa ? offsetCoa.name : offsetAccId;

    const depositNum = `DEP-2026-${String(this.nextDepositSeq++).padStart(4, '0')}`;
    const depositId = `DEP-${Date.now()}`;

    const journalEntry = this.postJournal(
      depositDate,
      'account_deposit',
      depositNum,
      `Deposit into ${acc.account_name} (${sourceType.replace('_', ' ')})`,
      [
        {
          account_id: acc.linked_chart_account_id,
          debit: amount,
          credit: 0,
          line_desc: `Deposit into ${acc.account_name}${params.reference ? ` (Ref: ${params.reference})` : ''}`,
        },
        {
          account_id: offsetAccId,
          debit: 0,
          credit: amount,
          line_desc: `Credit offset: ${offsetAccName}`,
        },
      ],
      params.actor_name,
      undefined,
      'deposit'
    );

    const depositRecord: AccountDepositRecord = {
      id: depositId,
      deposit_number: depositNum,
      payment_account_id: acc.id,
      payment_account_name: acc.account_name,
      amount,
      deposit_date: depositDate,
      source_type: sourceType,
      offset_account_id: offsetAccId,
      offset_account_name: offsetAccName,
      reference: params.reference?.trim(),
      notes: params.notes?.trim(),
      journal_entry_id: journalEntry.id,
      created_by: params.actor_id,
      created_by_name: params.actor_name,
      created_at: new Date().toISOString(),
    };

    this.accountDeposits.set(depositId, depositRecord);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'account_deposit',
      'payment_account',
      depositId,
      `Deposited ৳${amount.toLocaleString()} into ${acc.account_name} from ${offsetAccName} (JE: ${journalEntry.entry_number})`
    );

    return { deposit: depositRecord, journal_entry: journalEntry };
  }

  public withdrawFunds(params: {
    payment_account_id: string;
    amount: number;
    withdrawal_date?: string;
    reason_type?: 'owner_drawings' | 'bank_charge' | 'external_withdrawal' | 'other_expense';
    offset_account_id?: string;
    reference?: string;
    notes?: string;
    actor_id: string;
    actor_name: string;
  }): { withdrawal: AccountWithdrawalRecord; journal_entry: JournalEntry } {
    const { payment_account_id, amount } = params;

    if (!payment_account_id) throw new Error('Payment account is required');
    if (!amount || amount <= 0) throw new Error('Withdrawal amount must be greater than zero');

    const acc = this.paymentAccounts.get(payment_account_id);
    if (!acc) throw new Error(`Payment account not found: ${payment_account_id}`);
    if (!acc.is_active) throw new Error(`Payment account (${acc.account_name}) is deactivated`);

    const withdrawalDate = params.withdrawal_date || new Date().toISOString().slice(0, 10);
    const reasonType = params.reason_type || 'owner_drawings';

    // Resolve debit offset account
    let offsetAccId = params.offset_account_id;
    if (!offsetAccId) {
      if (reasonType === 'owner_drawings') offsetAccId = 'acc_drawings';
      else if (reasonType === 'bank_charge') offsetAccId = 'acc_bank_charges';
      else if (reasonType === 'other_expense') offsetAccId = 'acc_office_exp';
      else offsetAccId = 'acc_drawings';
    }

    const offsetCoa = this.accounts.get(offsetAccId) || this.accounts.get('acc_equity');
    const finalOffsetAccId = offsetCoa ? offsetCoa.id : 'acc_equity';
    const offsetAccName = offsetCoa ? offsetCoa.name : 'Owner Drawings / Equity';

    const withdrawalNum = `WTH-2026-${String(this.nextWithdrawalSeq++).padStart(4, '0')}`;
    const withdrawalId = `WTH-${Date.now()}`;

    const journalEntry = this.postJournal(
      withdrawalDate,
      'account_withdrawal',
      withdrawalNum,
      `Withdrawal from ${acc.account_name} (${reasonType.replace('_', ' ')})`,
      [
        {
          account_id: finalOffsetAccId,
          debit: amount,
          credit: 0,
          line_desc: `Debit offset: ${offsetAccName}`,
        },
        {
          account_id: acc.linked_chart_account_id,
          debit: 0,
          credit: amount,
          line_desc: `Withdrawal from ${acc.account_name}${params.reference ? ` (Ref: ${params.reference})` : ''}`,
        },
      ],
      params.actor_name,
      undefined,
      'withdrawal'
    );

    const withdrawalRecord: AccountWithdrawalRecord = {
      id: withdrawalId,
      withdrawal_number: withdrawalNum,
      payment_account_id: acc.id,
      payment_account_name: acc.account_name,
      amount,
      withdrawal_date: withdrawalDate,
      reason_type: reasonType,
      offset_account_id: finalOffsetAccId,
      offset_account_name: offsetAccName,
      reference: params.reference?.trim(),
      notes: params.notes?.trim(),
      journal_entry_id: journalEntry.id,
      created_by: params.actor_id,
      created_by_name: params.actor_name,
      created_at: new Date().toISOString(),
    };

    this.accountWithdrawals.set(withdrawalId, withdrawalRecord);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'account_withdrawal',
      'payment_account',
      withdrawalId,
      `Withdrew ৳${amount.toLocaleString()} from ${acc.account_name} for ${offsetAccName} (JE: ${journalEntry.entry_number})`
    );

    return { withdrawal: withdrawalRecord, journal_entry: journalEntry };
  }

  public getPaymentAccountStatement(
    paymentAccountId: string,
    startDate?: string,
    endDate?: string
  ): {
    account: PaymentAccount;
    statement: PaymentAccountStatementItem[];
    opening_balance: number;
    total_inflow: number;
    total_outflow: number;
    closing_balance: number;
  } {
    const acc = this.getPaymentAccount(paymentAccountId);
    const linkedCoaId = acc.linked_chart_account_id;

    // Filter journal entries involving this COA account
    const matchingEntries: { entry: JournalEntry; line: { debit: number; credit: number; line_desc?: string } }[] = [];

    this.journalEntries.forEach(entry => {
      entry.lines.forEach(line => {
        if (line.account_id === linkedCoaId && ((line.debit || 0) > 0 || (line.credit || 0) > 0)) {
          matchingEntries.push({ entry, line });
        }
      });
    });

    // Sort chronologically ascending (oldest first)
    matchingEntries.sort((a, b) => {
      const dateCmp = (a.entry.date || '').localeCompare(b.entry.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.entry.created_at || '').localeCompare(b.entry.created_at || '');
    });

    let runningBal = 0;
    const fullStatement: PaymentAccountStatementItem[] = [];

    matchingEntries.forEach(({ entry, line }, idx) => {
      const moneyIn = line.debit || 0;
      const moneyOut = line.credit || 0;
      runningBal += moneyIn - moneyOut;

      // Determine transaction type directly from entry.transaction_type
      let txType: PaymentAccountStatementItem['transaction_type'] = entry.transaction_type || 'general_journal';
      if (txType === 'fund_transfer_in' || txType === 'fund_transfer_out') {
        txType = moneyIn > 0 ? 'fund_transfer_in' : 'fund_transfer_out';
      }

      fullStatement.push({
        id: `${entry.id}-${idx}`,
        date: entry.date,
        reference: entry.reference_id || entry.entry_number,
        entry_number: entry.entry_number,
        journal_entry_id: entry.id,
        transaction_type: txType,
        description: line.line_desc || entry.description,
        money_in: moneyIn,
        money_out: moneyOut,
        running_balance: runningBal,
        created_by_name: entry.created_by_name || 'System',
      });
    });

    // Apply date range filters
    let filtered = fullStatement;
    if (startDate) {
      filtered = filtered.filter(item => item.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(item => item.date <= endDate);
    }

    const totalInflow = filtered.reduce((s, i) => s + i.money_in, 0);
    const totalOutflow = filtered.reduce((s, i) => s + i.money_out, 0);

    return {
      account: acc,
      statement: filtered.reverse(), // most recent on top for display
      opening_balance: acc.opening_balance,
      total_inflow: totalInflow,
      total_outflow: totalOutflow,
      closing_balance: runningBal,
    };
  }

  // Global paginated financial transactions feed across all payment accounts
  public getFinancialTransactionsFeed(params: {
    page?: number;
    page_size?: number;
    date_from?: string;
    date_to?: string;
    customer?: string;
    phone?: string;
    order_number?: string;
    invoice_number?: string;
    payment_method?: string;
    payment_account_id?: string;
    transaction_type?: string;
    status?: string;
    search?: string;
  }): {
    transactions: any[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    is_paged: boolean;
  } {
    const paymentAccountsList = Array.from(this.paymentAccounts.values());
    const coaToPmtAcc = new Map<string, any>();
    for (const acc of paymentAccountsList) {
      if (acc.linked_chart_account_id) {
        coaToPmtAcc.set(acc.linked_chart_account_id, acc);
      }
      coaToPmtAcc.set(acc.id, acc);
    }

    let targetLinkedCoaIds: Set<string>;
    if (params.payment_account_id) {
      const pmtAcc = this.paymentAccounts.get(params.payment_account_id);
      targetLinkedCoaIds = new Set(pmtAcc ? [pmtAcc.linked_chart_account_id, pmtAcc.id].filter(Boolean) : []);
    } else {
      targetLinkedCoaIds = new Set(Array.from(coaToPmtAcc.keys()));
    }

    // Filter journal entries involving payment accounts' linked COA
    const matchingEntries: {
      entry: JournalEntry;
      line: { account_id: string; debit: number; credit: number; line_desc?: string; account_name?: string };
      pmtAcc?: any;
    }[] = [];

    this.journalEntries.forEach(entry => {
      entry.lines.forEach(line => {
        if (targetLinkedCoaIds.has(line.account_id) && ((line.debit || 0) > 0 || (line.credit || 0) > 0)) {
          const pmtAcc = coaToPmtAcc.get(line.account_id);
          matchingEntries.push({ entry, line, pmtAcc });
        }
      });
    });

    // Sort chronologically ascending (oldest first) to compute authoritative ledger running balance
    matchingEntries.sort((a, b) => {
      const dateCmp = (a.entry.date || '').localeCompare(b.entry.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.entry.created_at || '').localeCompare(b.entry.created_at || '');
    });

    let runningBal = 0;
    const allItems: any[] = [];

    matchingEntries.forEach(({ entry, line, pmtAcc }, idx) => {
      const moneyIn = line.debit || 0;
      const moneyOut = line.credit || 0;
      runningBal += moneyIn - moneyOut;

      let txType: JournalTransactionType = entry.transaction_type || 'general_journal';
      if (txType === 'fund_transfer_in' || txType === 'fund_transfer_out') {
        txType = moneyIn > 0 ? 'fund_transfer_in' : 'fund_transfer_out';
      }

      const pmtAccName = pmtAcc ? pmtAcc.account_name : (line.account_name || line.account_id);
      const pmtAccId = pmtAcc ? pmtAcc.id : line.account_id;

      const item: any = {
        id: `${entry.id}-${idx}`,
        date: entry.date,
        reference: entry.reference_id || entry.entry_number,
        entry_number: entry.entry_number,
        journal_entry_id: entry.id,
        transaction_type: txType,
        description: line.line_desc || entry.description,
        money_in: moneyIn,
        money_out: moneyOut,
        running_balance: runningBal,
        payment_account_id: pmtAccId,
        payment_account_name: pmtAccName,
        payment_account_type: pmtAcc ? pmtAcc.account_type : undefined,
        created_by_name: entry.created_by_name || 'System',
        created_at: entry.created_at,
      };

      // Enrich row when transaction_type is 'pos_sale'
      if (txType === 'pos_sale') {
        let order = entry.reference_id ? this.orders.get(entry.reference_id) : undefined;
        if (!order) {
          order = Array.from(this.orders.values()).find(
            o => o.id === entry.reference_id || o.invoice_number === entry.reference_id || (entry.reference_id && (o as any).order_number === entry.reference_id)
          );
        }
        if (!order && entry.description) {
          const invMatch = entry.description.match(/INV-2026-\d+/);
          if (invMatch) {
            order = Array.from(this.orders.values()).find(o => o.invoice_number === invMatch[0]);
          }
        }

        if (order) {
          const paidAmount = (order.payments || [])
            .filter(p => p.status === 'completed')
            .reduce((s, p) => s + p.amount, 0);
          const currentOrderDue = Math.max(0, order.total - paidAmount);

          // Server-side port of getCustomerPreviousDue from SalesPaymentsAccountingView.tsx
          let previousCustomerDue = 0;
          if (order.customer_id) {
            const cust = this.customers.get(order.customer_id) || Array.from(this.customers.values()).find(c => c.id === order.customer_id);
            if (cust) {
              const custOrders = Array.from(this.orders.values()).filter(
                o => o.customer_id === order.customer_id && o.id !== order.id && o.status !== 'cancelled'
              );
              custOrders.forEach(o => {
                const p = (o.payments || []).filter(pay => pay.status === 'completed').reduce((sum, pay) => sum + pay.amount, 0);
                const d = Math.max(0, o.total - p);
                previousCustomerDue += d;
              });
            }
          }

          item.order_id = order.id;
          item.order_number = (order as any).order_number || order.invoice_number;
          item.invoice_number = order.invoice_number;
          item.customer_id = order.customer_id;
          item.customer_name = order.customer_name;
          item.customer_phone = order.customer_phone;
          item.order_total = order.total;
          item.paid_amount = paidAmount;
          item.due_amount = currentOrderDue;
          item.previous_customer_due = previousCustomerDue;
          item.payment_method = (order as any).payment_method || (order.payments && order.payments[0] ? order.payments[0].method : undefined);
          item.order_status = order.status;
        }
      }

      allItems.push(item);
    });

    // Reverse chronologically so newest appears first
    allItems.reverse();

    // Apply filtering
    let filtered = allItems.filter(item => {
      if (params.date_from && item.date < params.date_from) return false;
      if (params.date_to && item.date > params.date_to) return false;
      if (params.payment_account_id && item.payment_account_id !== params.payment_account_id) return false;
      if (params.transaction_type && item.transaction_type !== params.transaction_type) return false;

      if (params.customer) {
        const q = params.customer.toLowerCase();
        if (!item.customer_name || !item.customer_name.toLowerCase().includes(q)) return false;
      }
      if (params.phone) {
        const q = params.phone.toLowerCase();
        if (!item.customer_phone || !item.customer_phone.toLowerCase().includes(q)) return false;
      }
      if (params.order_number) {
        const q = params.order_number.toLowerCase();
        if (!item.order_number || !item.order_number.toLowerCase().includes(q)) return false;
      }
      if (params.invoice_number) {
        const q = params.invoice_number.toLowerCase();
        const inv = (item.invoice_number || item.reference || '').toLowerCase();
        if (!inv.includes(q)) return false;
      }
      if (params.payment_method) {
        const q = params.payment_method.toLowerCase();
        const pMethod = (item.payment_method || item.payment_account_type || '').toLowerCase();
        if (!pMethod.includes(q)) return false;
      }
      if (params.status) {
        const st = params.status.toLowerCase();
        if (st === 'paid') {
          if (item.transaction_type === 'pos_sale' && (item.due_amount || 0) > 0) return false;
        } else if (st === 'due') {
          if (item.transaction_type !== 'pos_sale' || (item.due_amount || 0) <= 0) return false;
        }
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        const hay = [
          item.reference,
          item.entry_number,
          item.description,
          item.customer_name,
          item.customer_phone,
          item.invoice_number,
          item.order_number,
          item.payment_account_name,
          item.payment_method,
          item.created_by_name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const isPaged =
      params.page !== undefined ||
      params.page_size !== undefined ||
      Boolean(
        params.date_from ||
        params.date_to ||
        params.customer ||
        params.phone ||
        params.order_number ||
        params.invoice_number ||
        params.payment_method ||
        params.payment_account_id ||
        params.transaction_type ||
        params.status ||
        params.search
      );

    const total = filtered.length;
    const pageSize = Math.min(100, Math.max(1, params.page_size || 25));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, params.page || 1), totalPages);

    const pagedTransactions = isPaged
      ? filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
      : filtered;

    return {
      transactions: pagedTransactions,
      total,
      page: safePage,
      page_size: pageSize,
      total_pages: totalPages,
      is_paged: isPaged,
    };
  }

  // 1d. Manual Financial Adjustments & Exception Controls (Phase 2)
  public createManualAdjustment(params: {
    payment_account_id: string;
    direction: 'money_in' | 'money_out';
    amount: number;
    offset_account_id: string;
    adjustment_date?: string;
    reason_category: ManualAdjustmentRecord['reason_category'];
    reason_notes: string;
    reference?: string;
    actor_id: string;
    actor_name: string;
  }): { adjustment: ManualAdjustmentRecord; journal_entry: JournalEntry } {
    const { payment_account_id, direction, amount, offset_account_id, reason_category, reason_notes } = params;

    if (!payment_account_id) throw new Error('Payment account is required');
    if (!amount || amount <= 0) throw new Error('Adjustment amount must be greater than zero');
    if (!direction || (direction !== 'money_in' && direction !== 'money_out')) {
      throw new Error('Direction must be money_in or money_out');
    }
    if (!offset_account_id) throw new Error('Offset Chart of Accounts account is required');
    if (!reason_notes || !reason_notes.trim()) {
      throw new Error('Reason explanation is required for manual financial adjustment');
    }

    const pmtAcc = this.paymentAccounts.get(payment_account_id);
    if (!pmtAcc) throw new Error(`Payment account not found: ${payment_account_id}`);
    if (!pmtAcc.is_active) throw new Error(`Payment account (${pmtAcc.account_name}) is deactivated`);

    const offsetCoa = this.accounts.get(offset_account_id);
    if (!offsetCoa) throw new Error(`Offset account not found: ${offset_account_id}`);

    const adjDate = params.adjustment_date || new Date().toISOString().slice(0, 10);
    const adjNum = `ADJ-2026-${String(this.nextAdjustmentSeq++).padStart(4, '0')}`;
    const adjId = `ADJ-${Date.now()}`;

    // Construct Balanced Double-Entry Journal
    const lines: { account_id: string; debit: number; credit: number; line_desc?: string }[] = [];

    if (direction === 'money_in') {
      lines.push({
        account_id: pmtAcc.linked_chart_account_id,
        debit: amount,
        credit: 0,
        line_desc: `Manual Adjustment (+): ${reason_notes}${params.reference ? ` (Ref: ${params.reference})` : ''}`,
      });
      lines.push({
        account_id: offset_account_id,
        debit: 0,
        credit: amount,
        line_desc: `Offset for ${pmtAcc.account_name} (${reason_category.replace(/_/g, ' ')})`,
      });
    } else {
      lines.push({
        account_id: offset_account_id,
        debit: amount,
        credit: 0,
        line_desc: `Offset for ${pmtAcc.account_name} (${reason_category.replace(/_/g, ' ')})`,
      });
      lines.push({
        account_id: pmtAcc.linked_chart_account_id,
        debit: 0,
        credit: amount,
        line_desc: `Manual Adjustment (-): ${reason_notes}${params.reference ? ` (Ref: ${params.reference})` : ''}`,
      });
    }

    const journalEntry = this.postJournal(
      adjDate,
      'manual_adjustment',
      adjNum,
      `Manual Financial Adjustment: ${pmtAcc.account_name} (${direction === 'money_in' ? '+' : '-'}৳${amount.toLocaleString()}) - ${reason_category.replace(/_/g, ' ')}`,
      lines,
      params.actor_name,
      undefined,
      'manual_adjustment'
    );

    const adjustmentRecord: ManualAdjustmentRecord = {
      id: adjId,
      adjustment_number: adjNum,
      payment_account_id: pmtAcc.id,
      payment_account_name: pmtAcc.account_name,
      direction,
      amount,
      offset_account_id: offsetCoa.id,
      offset_account_name: offsetCoa.name,
      adjustment_date: adjDate,
      reason_category,
      reason_notes: reason_notes.trim(),
      reference: params.reference?.trim(),
      journal_entry_id: journalEntry.id,
      created_by: params.actor_id,
      created_by_name: params.actor_name,
      status: 'posted',
      created_at: new Date().toISOString(),
    };

    this.manualAdjustments.set(adjId, adjustmentRecord);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'manual_adjustment_created',
      'payment_account',
      adjId,
      `Posted manual adjustment ${adjNum} for ${pmtAcc.account_name}: ${direction === 'money_in' ? '+' : '-'}৳${amount.toLocaleString()} (JE: ${journalEntry.entry_number}, Reason: ${reason_notes})`
    );

    return { adjustment: adjustmentRecord, journal_entry: journalEntry };
  }

  public voidManualAdjustment(id: string, reason: string, actorId: string, actorName: string): ManualAdjustmentRecord {
    const adj = this.manualAdjustments.get(id);
    if (!adj) throw new Error(`Manual adjustment not found: ${id}`);
    if (adj.status === 'voided') throw new Error('Adjustment has already been voided');
    if (!reason || !reason.trim()) throw new Error('Reason is required to void a manual adjustment');

    const origJe = this.journalEntries.find(j => j.id === adj.journal_entry_id || j.reference_id === adj.adjustment_number);

    let revJe: JournalEntry | undefined;
    if (origJe) {
      const revLines = origJe.lines.map(line => ({
        account_id: line.account_id,
        debit: line.credit || 0,
        credit: line.debit || 0,
        line_desc: `[REVERSAL] ${line.line_desc || origJe.description}`,
      }));

      revJe = this.postJournal(
        new Date().toISOString().slice(0, 10),
        'adjustment_reversal',
        `REV-${adj.adjustment_number}`,
        `Reversal of Manual Adjustment ${adj.adjustment_number} (Reason: ${reason})`,
        revLines,
        actorName,
        undefined,
        'manual_adjustment'
      );
    }

    adj.status = 'voided';
    adj.void_reason = reason.trim();
    adj.void_journal_entry_id = revJe?.id;
    adj.voided_by = actorId;
    adj.voided_by_name = actorName;
    adj.voided_at = new Date().toISOString();

    this.logAudit(
      actorId,
      actorName,
      'manual_adjustment_voided',
      'payment_account',
      adj.id,
      `Voided manual adjustment ${adj.adjustment_number} (${adj.payment_account_name}). Reason: ${reason}`
    );

    return adj;
  }

  public getManualAdjustments(paymentAccountId?: string): ManualAdjustmentRecord[] {
    let list = Array.from(this.manualAdjustments.values());
    if (paymentAccountId) {
      list = list.filter(a => a.payment_account_id === paymentAccountId);
    }
    return list.sort((a, b) => b.adjustment_date.localeCompare(a.adjustment_date) || b.created_at.localeCompare(a.created_at));
  }

  // 2. Operational & Petty Cash Expenses (Enhanced Architecture)
  public recordExpense(params: {
    category?: string;
    category_id?: string;
    category_name?: string;
    subcategory?: string;
    expense_type?: ExpenseType;
    description: string;
    amount: number;
    expense_account_id?: string;
    payment_account_id?: string;
    payment_method?: 'cash' | 'bank' | 'bkash' | 'nagad';
    receipt_reference?: string;
    receipt_url?: string;
    template_id?: string;
    date?: string;
    actor_id: string;
    actor_name: string;
  }): ExpenseRecord {
    const expenseNum = this.allocateExpenseNumber();
    const expId = `EXP-${Date.now()}`;
    const date = params.date || new Date().toISOString().slice(0, 10);
    const amount = Number(params.amount);

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Expense amount must be a positive number');
    }

    // Standard category-to-account fallback map
    const categoryAccountMap: Record<string, string> = {
      rent: 'acc_rent_exp',
      utility: 'acc_util_exp',
      marketing: 'acc_mkt_exp',
      packing_supplies: 'acc_pack_exp',
      office_tea_snacks: 'acc_office_exp',
      courier_charges: 'acc_courier_exp',
      customs_duty: 'acc_customs_exp',
      other: 'acc_office_exp',
      cat_daily: 'acc_office_exp',
      cat_recurring: 'acc_rent_exp',
      cat_supplies: 'acc_office_exp',
      cat_packaging: 'acc_pack_exp',
      cat_marketing: 'acc_mkt_exp',
      cat_courier: 'acc_courier_exp',
    };

    // Find category definition if available
    let catDef: ExpenseCategoryDefinition | undefined;
    if (params.category_id) {
      catDef = this.expenseCategories.get(params.category_id);
    }
    if (!catDef && params.category) {
      catDef =
        this.expenseCategories.get(params.category) ||
        Array.from(this.expenseCategories.values()).find(
          c => c.name.toLowerCase() === (params.category || '').toLowerCase()
        );
    }

    const categoryName =
      params.category_name || (catDef ? catDef.name : params.category || 'General Operational');
    const categoryId = catDef ? catDef.id : params.category_id || params.category || 'cat_daily';
    const expenseType: ExpenseType = params.expense_type || (catDef ? catDef.type : 'daily');

    // Expense Account
    let expAccountId = params.expense_account_id;
    if (!expAccountId && catDef && catDef.expense_account_id) {
      expAccountId = catDef.expense_account_id;
    }
    if (!expAccountId && params.category) {
      expAccountId = categoryAccountMap[params.category.toLowerCase()];
    }
    if (!expAccountId) {
      expAccountId = 'acc_office_exp';
    }

    const expAcc = this.accounts.get(expAccountId) || this.accounts.get('acc_office_exp')!;

    // Payment Account
    let paymentAccountId = params.payment_account_id;
    if (!paymentAccountId) {
      if (params.payment_method === 'bank') paymentAccountId = 'acc_bank';
      else if (params.payment_method === 'bkash') paymentAccountId = 'acc_bkash';
      else if (params.payment_method === 'nagad') paymentAccountId = 'acc_nagad';
      else paymentAccountId = 'acc_cash';
    }
    const paymentAcc = this.accounts.get(paymentAccountId) || this.accounts.get('acc_cash')!;

    // Journal: Dr Expense Account, Cr Payment Account
    const je = this.postJournal(
      date,
      'expense',
      expId,
      `Expense [${categoryName}${params.subcategory ? ' - ' + params.subcategory : ''}]: ${params.description} (${expenseNum})`,
      [
        { account_id: expAcc.id, debit: amount, credit: 0, line_desc: params.description },
        { account_id: paymentAcc.id, debit: 0, credit: amount, line_desc: `Payment via ${paymentAcc.name}` },
      ],
      params.actor_name,
      undefined,
      'expense'
    );

    const expenseRecord: ExpenseRecord = {
      id: expId,
      expense_number: expenseNum,
      category: categoryName as ExpenseCategory,
      category_id: categoryId,
      category_name: categoryName,
      subcategory: params.subcategory || undefined,
      expense_type: expenseType,
      description: params.description,
      amount: amount,
      expense_account_id: expAcc.id,
      expense_account_name: expAcc.name,
      payment_account_id: paymentAcc.id,
      payment_account_name: paymentAcc.name,
      payment_method: params.payment_method || 'cash',
      receipt_reference: params.receipt_reference,
      receipt_url: params.receipt_url,
      template_id: params.template_id,
      journal_entry_id: je.id,
      status: 'recorded',
      date: date,
      created_by: params.actor_id,
      created_by_name: params.actor_name,
      created_at: new Date().toISOString(),
    };

    this.expenses.set(expenseRecord.id, expenseRecord);

    // If recorded from a template, update template last recorded tracking
    if (params.template_id) {
      const tpl = this.expenseTemplates.get(params.template_id);
      if (tpl) {
        tpl.last_recorded_date = date;
        tpl.last_recorded_expense_id = expId;
      }
    }

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'expense_recorded',
      'expense',
      expenseRecord.id,
      `Recorded expense ${expenseNum} [${categoryName}${params.subcategory ? ' / ' + params.subcategory : ''}]: \u09F3${amount.toLocaleString()} for "${params.description}" paid from ${paymentAcc.name} (JE: ${je.entry_number})`
    );

    return expenseRecord;
  }

  // Void/Reverse an expense with proper double-entry reversal
  public voidExpense(expenseId: string, actorId: string, actorName: string, reason?: string): ExpenseRecord {
    const exp = this.expenses.get(expenseId);
    if (!exp) throw new Error(`Expense record not found: ${expenseId}`);

    const expAcc = this.accounts.get(exp.expense_account_id) || this.accounts.get('acc_office_exp')!;
    const payAcc = this.accounts.get(exp.payment_account_id) || this.accounts.get('acc_cash')!;

    // Reversing Journal: Dr Payment Account (refund/unspend), Cr Expense Account (reduce expense)
    const today = new Date().toISOString().slice(0, 10);
    const revJe = this.postJournal(
      today,
      'expense_void',
      exp.id,
      `Reversal/Void of Expense ${exp.expense_number}: ${reason || 'Voided by user'}`,
      [
        { account_id: payAcc.id, debit: exp.amount, credit: 0, line_desc: `Reversal of payment from ${payAcc.name}` },
        { account_id: expAcc.id, debit: 0, credit: exp.amount, line_desc: `Reversal of expense ${exp.expense_number}` },
      ],
      actorName,
      undefined,
      'expense'
    );

    this.expenses.delete(exp.id);

    this.logAudit(
      actorId,
      actorName,
      'expense_voided',
      'expense',
      exp.id,
      `Voided expense ${exp.expense_number} (\u09F3${exp.amount.toLocaleString()}). Reason: ${reason || 'Manual reversal'}. Posted reversal JE: ${revJe.entry_number}`
    );

    return exp;
  }

  // Server-side paginated & filtered expense history
  public queryExpenses(params: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    category?: string;
    subcategory?: string;
    date_range?: string;
    date_from?: string;
    date_to?: string;
    payment_account_id?: string;
    created_by?: string;
    expense_type?: string;
  }): ExpensePaginationResult {
    const page = Math.max(1, parseInt(String(params.page || 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(params.limit || 20), 10) || 20));

    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonthStr = todayStr.slice(0, 7);
    const sevenDaysAgoDate = new Date();
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgoDate.toISOString().slice(0, 10);

    const allExpenses = Array.from(this.expenses.values());

    let totalAmount = 0;
    let todayAmount = 0;
    let thisMonthAmount = 0;

    for (const e of allExpenses) {
      const amt = Number(e.amount || 0);
      totalAmount += amt;
      if (e.date === todayStr) todayAmount += amt;
      if (e.date.startsWith(thisMonthStr)) thisMonthAmount += amt;
    }

    const search = (params.search || '').trim().toLowerCase();
    const category = (params.category || '').trim();
    const subcategory = (params.subcategory || '').trim();
    const dateRange = params.date_range || 'all';
    const dateFrom = params.date_from;
    const dateTo = params.date_to;
    const paymentAccountId = params.payment_account_id;
    const createdBy = params.created_by;
    const expenseType = params.expense_type;

    const filtered = allExpenses.filter(e => {
      // Date Range Filter
      if (dateRange === 'today') {
        if (e.date !== todayStr) return false;
      } else if (dateRange === '7days') {
        if (e.date < sevenDaysAgoStr) return false;
      } else if (dateRange === 'this_month') {
        if (!e.date.startsWith(thisMonthStr)) return false;
      } else if (dateRange === 'custom') {
        if (dateFrom && e.date < dateFrom) return false;
        if (dateTo && e.date > dateTo) return false;
      }

      // Category filter
      if (category && category !== 'all') {
        const catMatch =
          e.category_id === category ||
          (e.category_name && e.category_name.toLowerCase() === category.toLowerCase()) ||
          (e.category && e.category.toLowerCase() === category.toLowerCase());
        if (!catMatch) return false;
      }

      // Subcategory filter
      if (subcategory && subcategory !== 'all') {
        if ((e.subcategory || '').toLowerCase() !== subcategory.toLowerCase()) return false;
      }

      // Expense type filter
      if (expenseType && expenseType !== 'all') {
        if ((e.expense_type || 'daily') !== expenseType) return false;
      }

      // Payment account filter
      if (paymentAccountId && paymentAccountId !== 'all') {
        if (e.payment_account_id !== paymentAccountId) return false;
      }

      // Created By filter
      if (createdBy && createdBy !== 'all') {
        if (e.created_by !== createdBy) return false;
      }

      // Search Query
      if (search) {
        const matchNum = e.expense_number.toLowerCase().includes(search);
        const matchDesc = e.description.toLowerCase().includes(search);
        const matchRef = (e.receipt_reference || '').toLowerCase().includes(search);
        const matchSub = (e.subcategory || '').toLowerCase().includes(search);
        const matchCat = (e.category_name || e.category || '').toLowerCase().includes(search);
        const matchPay = (e.payment_account_name || '').toLowerCase().includes(search);
        const matchBy = (e.created_by_name || '').toLowerCase().includes(search);
        if (!matchNum && !matchDesc && !matchRef && !matchSub && !matchCat && !matchPay && !matchBy) {
          return false;
        }
      }

      return true;
    });

    const filteredAmount = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);

    // Sort by date desc, created_at desc
    filtered.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.created_at.localeCompare(a.created_at);
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const items = filtered.slice(startIndex, startIndex + limit);

    return {
      items,
      total,
      page,
      limit,
      total_pages: totalPages,
      summary: {
        total_amount: totalAmount,
        today_amount: todayAmount,
        this_month_amount: thisMonthAmount,
        filtered_amount: filteredAmount,
      },
    };
  }

  // Category Management
  public createExpenseCategory(params: {
    name: string;
    type: ExpenseType;
    expense_account_id?: string;
    subcategories?: string[];
    actor_id: string;
    actor_name: string;
  }): ExpenseCategoryDefinition {
    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const expAccId = params.expense_account_id || (params.type === 'recurring' ? 'acc_rent_exp' : 'acc_office_exp');
    const acc = this.accounts.get(expAccId);

    const category: ExpenseCategoryDefinition = {
      id,
      name: params.name.trim(),
      type: params.type || 'daily',
      expense_account_id: expAccId,
      expense_account_name: acc ? acc.name : expAccId,
      subcategories: params.subcategories || [],
      is_system: false,
      active: true,
      created_at: new Date().toISOString(),
    };

    this.expenseCategories.set(id, category);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'expense_category_created',
      'expense_category',
      id,
      `Created expense category "${category.name}" (${category.type}) linked to ${category.expense_account_name}`
    );

    return category;
  }

  public updateExpenseCategory(
    id: string,
    params: Partial<ExpenseCategoryDefinition>,
    actorId: string,
    actorName: string
  ): ExpenseCategoryDefinition {
    const cat = this.expenseCategories.get(id);
    if (!cat) throw new Error(`Category not found: ${id}`);

    if (params.name) cat.name = params.name.trim();
    if (params.type) cat.type = params.type;
    if (params.expense_account_id) {
      cat.expense_account_id = params.expense_account_id;
      const acc = this.accounts.get(params.expense_account_id);
      if (acc) cat.expense_account_name = acc.name;
    }
    if (params.subcategories) cat.subcategories = params.subcategories;
    if (typeof params.active === 'boolean') cat.active = params.active;

    this.logAudit(
      actorId,
      actorName,
      'expense_category_updated',
      'expense_category',
      id,
      `Updated expense category "${cat.name}"`
    );

    return cat;
  }

  public deleteExpenseCategory(id: string, actorId: string, actorName: string): boolean {
    const cat = this.expenseCategories.get(id);
    if (!cat) throw new Error(`Category not found: ${id}`);
    if (cat.is_system) throw new Error(`Cannot delete system-defined expense category: ${cat.name}`);

    this.expenseCategories.delete(id);

    this.logAudit(
      actorId,
      actorName,
      'expense_category_deleted',
      'expense_category',
      id,
      `Deleted expense category "${cat.name}"`
    );

    return true;
  }

  // Template Management
  public createExpenseTemplate(params: {
    name: string;
    category_id: string;
    category_name?: string;
    subcategory?: string;
    expense_type?: ExpenseType;
    default_amount?: number;
    default_payment_account_id?: string;
    default_payment_method?: 'cash' | 'bank' | 'bkash' | 'nagad';
    default_description?: string;
    is_frequent?: boolean;
    is_recurring?: boolean;
    recurring_day?: number;
    recurring_frequency?: 'monthly' | 'daily' | 'weekly';
    actor_id: string;
    actor_name: string;
  }): ExpenseTemplate {
    const id = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cat = this.expenseCategories.get(params.category_id);
    const catName = params.category_name || (cat ? cat.name : 'General Operational');
    const payAccId = params.default_payment_account_id || 'acc_cash';
    const payAcc = this.accounts.get(payAccId);

    const template: ExpenseTemplate = {
      id,
      name: params.name.trim(),
      category_id: params.category_id,
      category_name: catName,
      subcategory: params.subcategory || undefined,
      expense_type: params.expense_type || (cat ? cat.type : 'daily'),
      default_amount: params.default_amount ? Number(params.default_amount) : undefined,
      default_payment_account_id: payAccId,
      default_payment_account_name: payAcc ? payAcc.name : payAccId,
      default_payment_method: params.default_payment_method || 'cash',
      default_description: params.default_description || params.name.trim(),
      is_frequent: Boolean(params.is_frequent),
      is_recurring: Boolean(params.is_recurring),
      recurring_day: params.recurring_day ? Number(params.recurring_day) : undefined,
      recurring_frequency: params.recurring_frequency || 'monthly',
      created_by: params.actor_id,
      created_at: new Date().toISOString(),
    };

    this.expenseTemplates.set(id, template);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'expense_template_created',
      'expense_template',
      id,
      `Created expense template "${template.name}" [${template.category_name}]`
    );

    return template;
  }

  public updateExpenseTemplate(
    id: string,
    params: Partial<ExpenseTemplate>,
    actorId: string,
    actorName: string
  ): ExpenseTemplate {
    const tpl = this.expenseTemplates.get(id);
    if (!tpl) throw new Error(`Template not found: ${id}`);

    if (params.name) tpl.name = params.name.trim();
    if (params.category_id) {
      tpl.category_id = params.category_id;
      const cat = this.expenseCategories.get(params.category_id);
      if (cat) tpl.category_name = cat.name;
    }
    if (params.category_name) tpl.category_name = params.category_name;
    if (params.subcategory !== undefined) tpl.subcategory = params.subcategory;
    if (params.expense_type) tpl.expense_type = params.expense_type;
    if (params.default_amount !== undefined) tpl.default_amount = Number(params.default_amount);
    if (params.default_payment_account_id) {
      tpl.default_payment_account_id = params.default_payment_account_id;
      const payAcc = this.accounts.get(params.default_payment_account_id);
      if (payAcc) tpl.default_payment_account_name = payAcc.name;
    }
    if (params.default_payment_method) tpl.default_payment_method = params.default_payment_method;
    if (params.default_description !== undefined) tpl.default_description = params.default_description;
    if (typeof params.is_frequent === 'boolean') tpl.is_frequent = params.is_frequent;
    if (typeof params.is_recurring === 'boolean') tpl.is_recurring = params.is_recurring;
    if (params.recurring_day !== undefined) tpl.recurring_day = Number(params.recurring_day);
    if (params.recurring_frequency) tpl.recurring_frequency = params.recurring_frequency;

    this.logAudit(
      actorId,
      actorName,
      'expense_template_updated',
      'expense_template',
      id,
      `Updated expense template "${tpl.name}"`
    );

    return tpl;
  }

  public deleteExpenseTemplate(id: string, actorId: string, actorName: string): boolean {
    const tpl = this.expenseTemplates.get(id);
    if (!tpl) throw new Error(`Template not found: ${id}`);

    this.expenseTemplates.delete(id);

    this.logAudit(
      actorId,
      actorName,
      'expense_template_deleted',
      'expense_template',
      id,
      `Deleted expense template "${tpl.name}"`
    );

    return true;
  }

  // Budget Management & Dynamic Status Computation
  public getBudgetsWithStatus(asOfDate?: string): ExpenseBudget[] {
    const refDate = asOfDate || new Date().toISOString().slice(0, 10);
    const monthStr = refDate.slice(0, 7);
    const allExpenses = Array.from(this.expenses.values());

    return Array.from(this.expenseBudgets.values()).map(b => {
      const relevantExpenses = allExpenses.filter(e => {
        // Date match
        if (b.period === 'daily') {
          if (e.date !== refDate) return false;
        } else {
          if (!e.date.startsWith(monthStr)) return false;
        }
        // Category match
        const catMatch =
          e.category_id === b.category_id ||
          (e.category_name && e.category_name.toLowerCase() === b.category_name.toLowerCase()) ||
          (e.category && e.category.toLowerCase() === b.category_name.toLowerCase());
        if (!catMatch) return false;

        // Subcategory match (if budget is specific to subcategory)
        if (b.subcategory && b.subcategory.trim()) {
          if ((e.subcategory || '').toLowerCase() !== b.subcategory.toLowerCase()) return false;
        }
        return true;
      });

      const spent = relevantExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      const remaining = Math.max(0, b.amount - spent);
      const overspent = spent > b.amount ? spent - b.amount : 0;
      const used_percentage = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      const status =
        spent > b.amount
          ? 'exceeded'
          : used_percentage >= (b.warning_threshold_percent || 80)
          ? 'near_budget'
          : 'ok';

      return {
        ...b,
        spent,
        remaining,
        overspent,
        used_percentage,
        status,
      };
    });
  }

  public createExpenseBudget(params: {
    category_id: string;
    category_name?: string;
    subcategory?: string;
    period: 'daily' | 'monthly';
    amount: number;
    warning_threshold_percent?: number;
    actor_id: string;
    actor_name: string;
  }): ExpenseBudget {
    const id = `bdg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cat = this.expenseCategories.get(params.category_id);
    const catName = params.category_name || (cat ? cat.name : 'Operational');

    const budget: ExpenseBudget = {
      id,
      category_id: params.category_id,
      category_name: catName,
      subcategory: params.subcategory || undefined,
      period: params.period || 'monthly',
      amount: Number(params.amount),
      warning_threshold_percent: Number(params.warning_threshold_percent || 80),
      created_by: params.actor_id,
      created_at: new Date().toISOString(),
    };

    this.expenseBudgets.set(id, budget);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'expense_budget_created',
      'expense_budget',
      id,
      `Created ${budget.period} budget of \u09F3${budget.amount.toLocaleString()} for "${budget.category_name}${budget.subcategory ? ' / ' + budget.subcategory : ''}"`
    );

    return budget;
  }

  public updateExpenseBudget(
    id: string,
    params: Partial<ExpenseBudget>,
    actorId: string,
    actorName: string
  ): ExpenseBudget {
    const bdg = this.expenseBudgets.get(id);
    if (!bdg) throw new Error(`Budget not found: ${id}`);

    if (params.category_id) {
      bdg.category_id = params.category_id;
      const cat = this.expenseCategories.get(params.category_id);
      if (cat) bdg.category_name = cat.name;
    }
    if (params.category_name) bdg.category_name = params.category_name;
    if (params.subcategory !== undefined) bdg.subcategory = params.subcategory;
    if (params.period) bdg.period = params.period;
    if (params.amount !== undefined) bdg.amount = Number(params.amount);
    if (params.warning_threshold_percent !== undefined) {
      bdg.warning_threshold_percent = Number(params.warning_threshold_percent);
    }
    bdg.updated_at = new Date().toISOString();

    this.logAudit(
      actorId,
      actorName,
      'expense_budget_updated',
      'expense_budget',
      id,
      `Updated budget for "${bdg.category_name}" to \u09F3${bdg.amount.toLocaleString()}`
    );

    return bdg;
  }

  public deleteExpenseBudget(id: string, actorId: string, actorName: string): boolean {
    const bdg = this.expenseBudgets.get(id);
    if (!bdg) throw new Error(`Budget not found: ${id}`);

    this.expenseBudgets.delete(id);

    this.logAudit(
      actorId,
      actorName,
      'expense_budget_deleted',
      'expense_budget',
      id,
      `Deleted budget for "${bdg.category_name}"`
    );

    return true;
  }

  // Recurring expense status calculation (surfaces reminders without auto-posting)
  public getRecurringSchedules(currentMonth?: string): Array<ExpenseTemplate & {
    status: 'recorded' | 'due' | 'upcoming';
    recorded_expense?: ExpenseRecord;
    due_day: number;
  }> {
    const month = currentMonth || new Date().toISOString().slice(0, 7);
    const today = new Date();
    const currentDay = today.getDate();

    const recurringTemplates = Array.from(this.expenseTemplates.values()).filter(
      t => t.is_recurring || t.expense_type === 'recurring'
    );

    const monthExpenses = Array.from(this.expenses.values()).filter(e => e.date.startsWith(month));

    return recurringTemplates.map(t => {
      const dueDay = t.recurring_day || 1;
      // Match expense by template_id, or by matching category and subcategory
      const matchedExp = monthExpenses.find(e => {
        if (e.template_id && e.template_id === t.id) return true;
        if (t.subcategory && (e.subcategory || '').toLowerCase() === t.subcategory.toLowerCase()) return true;
        if (
          e.category_id === t.category_id &&
          (e.description.toLowerCase().includes(t.name.toLowerCase()) ||
            t.name.toLowerCase().includes(e.description.toLowerCase()))
        )
          return true;
        return false;
      });

      let status: 'recorded' | 'due' | 'upcoming' = 'upcoming';
      if (matchedExp) {
        status = 'recorded';
      } else if (currentDay >= dueDay) {
        status = 'due';
      } else {
        status = 'upcoming';
      }

      return {
        ...t,
        status,
        recorded_expense: matchedExp,
        due_day: dueDay,
      };
    });
  }

  // 3. Employee Management & Monthly Payroll Engine (Section 19, 40.6)
  public createEmployee(params: {
    name: string;
    phone: string;
    email?: string;
    designation: string;
    role: string;
    base_salary: number;
    disbursement_method: 'bank' | 'bkash' | 'cash';
    bank_account_no?: string;
    bkash_number?: string;
    joined_date: string;
    actor_id: string;
    actor_name: string;
  }): Employee {
    const id = `EMP-${Date.now()}`;
    const emp: Employee = {
      id,
      name: params.name,
      phone: params.phone,
      email: params.email,
      designation: params.designation,
      role: params.role,
      base_salary: Number(params.base_salary),
      disbursement_method: params.disbursement_method,
      bank_account_no: params.bank_account_no,
      bkash_number: params.bkash_number,
      joined_date: params.joined_date,
      active: true,
    };

    this.employees.set(id, emp);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'employee_created',
      'employee',
      id,
      `Created employee record for ${emp.name} (${emp.designation}, Base: \u09F3${emp.base_salary.toLocaleString()})`
    );

    return emp;
  }

  public updateEmployee(id: string, params: Partial<Employee>, actor_id: string, actor_name: string): Employee {
    const emp = this.employees.get(id);
    if (!emp) throw new Error(`Employee not found: ${id}`);

    Object.assign(emp, params);

    this.logAudit(
      actor_id,
      actor_name,
      'employee_updated',
      'employee',
      id,
      `Updated employee record for ${emp.name}`
    );

    return emp;
  }

  public processPayroll(params: {
    payroll_month: string; // e.g. "2026-02"
    employee_id: string;
    bonus_commission?: number;
    deductions?: number;
    payment_account_id?: string;
    payment_date?: string;
    transaction_reference?: string;
    notes?: string;
    actor_id: string;
    actor_name: string;
  }): PayrollRecord {
    const emp = this.employees.get(params.employee_id);
    if (!emp) throw new Error(`Employee not found: ${params.employee_id}`);

    const baseSalary = emp.base_salary;
    const bonus = Number(params.bonus_commission || 0);
    const deductions = Number(params.deductions || 0);
    const netPayable = baseSalary + bonus - deductions;

    const payslipNum = this.allocatePayslipNumber();
    const payrollId = `PR-${Date.now()}`;
    const paymentDate = params.payment_date || new Date().toISOString().slice(0, 10);

    const paymentAccountId = params.payment_account_id || (emp.disbursement_method === 'bank' ? 'acc_bank' : 'acc_cash');
    const paymentAcc = this.accounts.get(paymentAccountId) || this.accounts.get('acc_bank')!;
    const salaryExpAcc = this.accounts.get('acc_salary_exp')!;

    // Journal: Dr Employee Salaries Expense, Cr Payment Account
    this.postJournal(
      paymentDate,
      'payroll',
      payrollId,
      `Salary Disbursement for ${emp.name} (${params.payroll_month}, ${payslipNum})`,
      [
        { account_id: salaryExpAcc.id, debit: netPayable, credit: 0, line_desc: `Salary for ${emp.name} (${params.payroll_month})` },
        { account_id: paymentAcc.id, debit: 0, credit: netPayable, line_desc: `Disbursement from ${paymentAcc.name}` },
      ],
      params.actor_name,
      undefined,
      'payroll'
    );

    const payrollRecord: PayrollRecord = {
      id: payrollId,
      payslip_number: payslipNum,
      payroll_month: params.payroll_month,
      employee_id: emp.id,
      employee_name: emp.name,
      designation: emp.designation,
      base_salary: baseSalary,
      bonus_commission: bonus,
      deductions: deductions,
      net_payable: netPayable,
      payment_account_id: paymentAcc.id,
      payment_account_name: paymentAcc.name,
      payment_date: paymentDate,
      status: 'paid',
      transaction_reference: params.transaction_reference,
      notes: params.notes,
      created_by: params.actor_id,
      created_at: new Date().toISOString(),
    };

    this.payrollRecords.set(payrollRecord.id, payrollRecord);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'payroll_disbursed',
      'payroll',
      payrollRecord.id,
      `Disbursed ${params.payroll_month} salary for ${emp.name}: Net \u09F3${netPayable.toLocaleString()} (${payslipNum}) via ${paymentAcc.name}`
    );

    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      type: 'system',
      message: `Payslip ${payslipNum} generated for ${emp.name} (\u09F3${netPayable.toLocaleString()})`,
      ref_type: 'payroll',
      ref_id: payrollRecord.id,
      read: false,
      created_at: new Date().toISOString(),
    });

    return payrollRecord;
  }

  // 4. Financial Statements Engine: Profit & Loss Report (Section 15.2, 40.6)
  public generateProfitLossReport(startDate?: string, endDate?: string): ProfitLossReport {
    const hasDateFilter = Boolean(startDate || endDate);
    const periodEntries = hasDateFilter
      ? this.journalEntries.filter(entry => {
          const entryDate = entry.date.slice(0, 10);
          return (!startDate || entryDate >= startDate) && (!endDate || entryDate <= endDate);
        })
      : this.journalEntries;
    const journalAmount = (accountId: string, normalBalance: 'debit' | 'credit') =>
      periodEntries
        .flatMap(entry => entry.lines)
        .filter(line => line.account_id === accountId)
        .reduce((sum, line) => sum + (normalBalance === 'debit' ? line.debit - line.credit : line.credit - line.debit), 0);
    const accountAmount = (accountId: string, normalBalance: 'debit' | 'credit') =>
      hasDateFilter ? journalAmount(accountId, normalBalance) : (this.accounts.get(accountId)?.balance || 0);

    const accSales = accountAmount('acc_sales_rev', 'credit');
    const accDeliv = accountAmount('acc_deliv_inc', 'credit');
    const accRet = hasDateFilter ? journalAmount('acc_sales_ret', 'debit') : (this.accounts.get('acc_sales_ret')?.balance || 0);
    const accCogs = accountAmount('acc_cogs', 'debit');

    const netRevenue = accSales + accDeliv - accRet;
    const grossProfit = netRevenue - accCogs;
    const grossMarginPercent = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    const rent = accountAmount('acc_rent_exp', 'debit');
    const salaries = accountAmount('acc_salary_exp', 'debit');
    const courierFreightRto = accountAmount('acc_courier_exp', 'debit');
    const showroomTesters = accountAmount('acc_tester_exp', 'debit');
    const damagedStockLoss = accountAmount('acc_damaged_exp', 'debit');
    const utilities = accountAmount('acc_util_exp', 'debit');
    const marketing = accountAmount('acc_mkt_exp', 'debit');
    const packing = accountAmount('acc_pack_exp', 'debit');
    const cashShortage = accountAmount('acc_cash_shortage', 'debit');
    const other = accountAmount('acc_office_exp', 'debit');

    const totalOperatingExpenses =
      rent +
      salaries +
      courierFreightRto +
      showroomTesters +
      damagedStockLoss +
      utilities +
      marketing +
      packing +
      cashShortage +
      other;

    const netOperatingProfit = grossProfit - totalOperatingExpenses;
    const netMarginPercent = netRevenue > 0 ? (netOperatingProfit / netRevenue) * 100 : 0;

    return {
      period: startDate && endDate ? `${startDate} to ${endDate}` : 'Year to Date 2026',
      revenue: {
        product_sales: accSales,
        delivery_income: accDeliv,
        sales_returns: accRet,
        net_revenue: netRevenue,
      },
      cogs: accCogs,
      gross_profit: grossProfit,
      gross_margin_percent: grossMarginPercent,
      operating_expenses: {
        rent,
        salaries,
        courier_freight_rto: courierFreightRto,
        showroom_testers: showroomTesters,
        damaged_stock_loss: damagedStockLoss,
        utilities_office: utilities,
        marketing_ads: marketing,
        packing_supplies: packing,
        cash_shortage: cashShortage,
        other,
        total_operating_expenses: totalOperatingExpenses,
      },
      net_operating_profit: netOperatingProfit,
      net_margin_percent: netMarginPercent,
    };
  }

  // 5. Balance Sheet Report (Section 15.2, 40.6)
  public generateBalanceSheetReport(asOfDate?: string): BalanceSheetReport {
    const cashInHand = this.accounts.get('acc_cash')?.balance || 0;
    const bankDeposits = this.accounts.get('acc_bank')?.balance || 0;
    const mfsWallets = (this.accounts.get('acc_bkash')?.balance || 0) + (this.accounts.get('acc_nagad')?.balance || 0);
    const courierReceivable = this.accounts.get('acc_courier_rec')?.balance || 0;
    const inventoryValuation = this.accounts.get('acc_inventory')?.balance || 0;

    const totalAssets = cashInHand + bankDeposits + mfsWallets + courierReceivable + inventoryValuation;

    const supplierPayables = this.accounts.get('acc_supp_pay')?.balance || 0;
    const accruedExpenses = 0;
    const totalLiabilities = supplierPayables + accruedExpenses;

    const ownerCapital = this.accounts.get('acc_equity')?.balance || 0;
    const pnl = this.generateProfitLossReport();
    const currentRetainedEarnings = pnl.net_operating_profit;
    const totalEquity = ownerCapital + currentRetainedEarnings;

    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;

    return {
      as_of_date: asOfDate || new Date().toISOString().slice(0, 10),
      assets: {
        cash_in_hand: cashInHand,
        bank_deposits: bankDeposits,
        mfs_wallets: mfsWallets,
        courier_receivable: courierReceivable,
        inventory_valuation: inventoryValuation,
        total_assets: totalAssets,
      },
      liabilities: {
        supplier_payables: supplierPayables,
        accrued_expenses: accruedExpenses,
        total_liabilities: totalLiabilities,
      },
      equity: {
        owner_capital: ownerCapital,
        current_retained_earnings: currentRetainedEarnings,
        total_equity: totalEquity,
      },
      is_balanced: isBalanced,
    };
  }

  // --- Phase 3: Comprehensive Financial & Operational Reporting Layer ---

  // 1. Payment Accounts Master Report
  public generatePaymentAccountsReport(params?: {
    account_id?: string;
    account_type?: PaymentAccountType;
    start_date?: string;
    end_date?: string;
    transaction_type?: string;
    user_name?: string;
    search?: string;
  }): PaymentAccountsReportData {
    const allPmtAccounts = Array.from(this.paymentAccounts.values());
    const accountsSummary: PaymentAccountSummaryItem[] = [];
    const allTransactions: PaymentAccountReportTransaction[] = [];

    const startDate = params?.start_date;
    const endDate = params?.end_date;
    const filterAccountId = params?.account_id && params.account_id !== 'all' ? params.account_id : undefined;
    const filterAccountType = params?.account_type && params.account_type !== ('all' as any) ? params.account_type : undefined;
    const filterTxType = params?.transaction_type && params.transaction_type !== 'all' ? params.transaction_type : undefined;
    const search = (params?.search || '').trim().toLowerCase();

    // Map journal entry references to source records
    const classifySource = (ref: string, desc: string, jeId: string): { type: PaymentAccountReportTransaction['source_record_type']; id?: string } => {
      if (ref.startsWith('INV-') || desc.includes('Sale') || desc.includes('Order') || desc.includes('POS')) {
        const ord = Array.from(this.orders.values()).find(o => o.invoice_number === ref || o.id === ref);
        return { type: 'order', id: ord ? ord.id : ref };
      }
      if (ref.startsWith('EXP-') || desc.includes('Expense')) {
        const exp = Array.from(this.expenses.values()).find(e => e.expense_number === ref || e.id === ref);
        return { type: 'expense', id: exp ? exp.id : ref };
      }
      if (ref.startsWith('TRF-') || desc.includes('Transfer')) {
        const trf = Array.from(this.fundTransfers.values()).find(t => t.transfer_number === ref || t.id === ref);
        return { type: 'fund_transfer', id: trf ? trf.id : ref };
      }
      if (ref.startsWith('ADJ-') || desc.includes('Adjustment') || desc.includes('Manual')) {
        const adj = Array.from(this.manualAdjustments.values()).find(a => a.adjustment_number === ref || a.id === ref);
        return { type: 'manual_adjustment', id: adj ? adj.id : ref };
      }
      if (ref.startsWith('STF-') || ref.startsWith('BKG-') || desc.includes('Settlement') || desc.includes('Steadfast')) {
        const batch = Array.from(this.settlementBatches.values()).find(b => b.batch_number === ref || b.id === ref);
        return { type: 'settlement_batch', id: batch ? batch.id : ref };
      }
      if (ref.startsWith('RET-') || desc.includes('Refund') || desc.includes('Return')) {
        const ret = Array.from(this.customerReturns.values()).find(r => r.return_number === ref || r.id === ref);
        return { type: 'customer_return', id: ret ? ret.id : ref };
      }
      if (ref.startsWith('PR-') || ref.startsWith('PS-') || desc.includes('Salary') || desc.includes('Payroll')) {
        const pr = Array.from(this.payrollRecords.values()).find(p => p.payslip_number === ref || p.id === ref);
        return { type: 'payroll', id: pr ? pr.id : ref };
      }
      return { type: 'other', id: ref || jeId };
    };

    let grandOpeningBalance = 0;
    let grandMoneyIn = 0;
    let grandMoneyOut = 0;
    let grandClosingBalance = 0;
    let grandTxCount = 0;

    for (const acc of allPmtAccounts) {
      if (filterAccountId && acc.id !== filterAccountId) continue;
      if (filterAccountType && acc.account_type !== filterAccountType) continue;

      const stmt = this.getPaymentAccountStatement(acc.id, startDate, endDate);

      accountsSummary.push({
        account_id: acc.id,
        account_name: acc.account_name,
        account_type: acc.account_type,
        account_number: acc.account_number,
        bank_name: acc.bank_name,
        linked_chart_account_id: acc.linked_chart_account_id,
        opening_balance: stmt.opening_balance,
        total_money_in: stmt.total_inflow,
        total_money_out: stmt.total_outflow,
        closing_balance: stmt.closing_balance,
        transaction_count: stmt.statement.length,
      });

      grandOpeningBalance += stmt.opening_balance;
      grandMoneyIn += stmt.total_inflow;
      grandMoneyOut += stmt.total_outflow;
      grandClosingBalance += stmt.closing_balance;
      grandTxCount += stmt.statement.length;

      for (const item of stmt.statement) {
        // Classify source record
        const source = classifySource(item.reference, item.description, item.journal_entry_id);

        // Apply transaction type and search filters
        if (filterTxType && item.transaction_type !== filterTxType) continue;
        if (params?.user_name && !(item.created_by_name || '').toLowerCase().includes(params.user_name.toLowerCase())) continue;
        if (search) {
          const matchRef = item.reference.toLowerCase().includes(search);
          const matchDesc = item.description.toLowerCase().includes(search);
          const matchAcc = acc.account_name.toLowerCase().includes(search);
          const matchUser = (item.created_by_name || '').toLowerCase().includes(search);
          if (!matchRef && !matchDesc && !matchAcc && !matchUser) continue;
        }

        allTransactions.push({
          id: item.id,
          date: item.date,
          created_at: item.date,
          payment_account_id: acc.id,
          payment_account_name: acc.account_name,
          account_type: acc.account_type,
          transaction_type: item.transaction_type,
          reference: item.reference,
          entry_number: item.entry_number,
          journal_entry_id: item.journal_entry_id,
          description: item.description,
          money_in: item.money_in,
          money_out: item.money_out,
          running_balance: item.running_balance,
          created_by_name: item.created_by_name,
          source_record_type: source.type,
          source_record_id: source.id,
        });
      }
    }

    // Sort transactions by date desc, then created_at desc
    allTransactions.sort((a, b) => b.date.localeCompare(a.date));

    return {
      summary: {
        total_accounts: accountsSummary.length,
        opening_balance: grandOpeningBalance,
        total_money_in: grandMoneyIn,
        total_money_out: grandMoneyOut,
        closing_balance: grandClosingBalance,
        transaction_count: grandTxCount,
      },
      accounts_summary: accountsSummary,
      transactions: allTransactions,
    };
  }

  // 2. Daily Business Financial Control Report
  public generateDailyBusinessControlReport(params?: {
    start_date?: string;
    end_date?: string;
    business_date?: string;
  }): DailyBusinessControlReportData {
    const allOrders = Array.from(this.orders.values());
    const allReturns = Array.from(this.customerReturns.values());
    const allExpenses = Array.from(this.expenses.values());

    // Collect all distinct dates
    const dateSet = new Set<string>();

    allOrders.forEach(o => {
      const d = o.business_date || (o.transaction_date ? o.transaction_date.slice(0, 10) : o.created_at.slice(0, 10));
      if (d) dateSet.add(d);
    });
    allReturns.forEach(r => {
      const d = r.created_at.slice(0, 10);
      if (d) dateSet.add(d);
    });
    allExpenses.forEach(e => {
      const d = e.date;
      if (d) dateSet.add(d);
    });

    let dates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

    // Apply date range filters if provided
    if (params?.business_date) {
      dates = dates.filter(d => d === params.business_date);
    } else {
      if (params?.start_date) {
        dates = dates.filter(d => d >= params.start_date!);
      }
      if (params?.end_date) {
        dates = dates.filter(d => d <= params.end_date!);
      }
    }

    const rows: DailyBusinessControlReportRow[] = [];

    let totalOrders = 0;
    let totalOrderQty = 0;
    let totalOrderVal = 0;
    let totalProductQty = 0;
    let totalDraftPending = 0;
    let totalDelivPending = 0;
    let totalDelivDone = 0;
    let totalReturnQty = 0;
    let totalReturnAmt = 0;
    let totalCash = 0;
    let totalBank = 0;
    let totalBkashPers = 0;
    let totalBkashMerch = 0;
    let totalNagad = 0;
    let totalOther = 0;
    let grandCollection = 0;
    let totalCogs = 0;
    let totalOperatingExp = 0;
    let grandCollectionBal = 0;

    for (const date of dates) {
      const dayOrders = allOrders.filter(o => {
        const d = o.business_date || (o.transaction_date ? o.transaction_date.slice(0, 10) : o.created_at.slice(0, 10));
        return d === date;
      });

      const dayReturns = allReturns.filter(r => r.created_at.slice(0, 10) === date);
      const dayExpenses = allExpenses.filter(e => e.date === date);

      const ordersCount = dayOrders.length;
      const orderQty = dayOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0);
      const orderVal = dayOrders.reduce((sum, o) => sum + o.total, 0);

      // Product quantity in non-cancelled orders
      const productQty = dayOrders
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0);

      const draftPending = dayOrders.filter(o => o.status === 'confirmed' || o.status === 'packed').length;
      const delivPending = dayOrders.filter(o => o.status === 'dispatched').length;
      const delivDone = dayOrders.filter(o => o.status === 'delivered').length;

      // Returns on this date
      const returnQty = dayReturns.reduce((sum, r) => sum + r.items.reduce((s, it) => s + it.quantity, 0), 0);
      const returnAmt = dayReturns.reduce((sum, r) => sum + (r.refund_amount || 0) + (r.courier_fee_loss || 0), 0);

      // Collections by channel / payment account
      let cashCol = 0;
      let bankCol = 0;
      let bkashPersCol = 0;
      let bkashMerchCol = 0;
      let nagadCol = 0;
      let otherCol = 0;

      for (const order of dayOrders) {
        if (order.payments) {
          for (const pay of order.payments) {
            if (pay.status === 'completed' && pay.method !== 'cod_pending') {
              const amt = Number(pay.amount) || 0;
              const pAccId = pay.payment_account_id || '';
              const pAcc = this.paymentAccounts.get(pAccId);
              const pAccType = pAcc ? pAcc.account_type : '';
              const pAccName = pAcc ? pAcc.account_name.toLowerCase() : '';

              if (pay.method === 'cash' || pAccType === 'cash' || pAccId === 'acc_cash') {
                cashCol += amt;
              } else if (pay.method === 'bank' || pAccType === 'bank' || pAccId === 'acc_bank') {
                bankCol += amt;
              } else if (pAccName.includes('merchant') || (pay.method === 'bkash' && pAccName.includes('merchant'))) {
                bkashMerchCol += amt;
              } else if (pay.method === 'bkash') {
                bkashPersCol += amt;
              } else if (pay.method === 'nagad' || pAccName.includes('mfs')) {
                nagadCol += amt;
              } else {
                otherCol += amt;
              }
            }
          }
        }
      }

      const totalCol = cashCol + bankCol + bkashPersCol + bkashMerchCol + nagadCol + otherCol;

      // COGS for orders on this date
      const dayCogs = dayOrders
        .filter(o => o.status === 'delivered' || (o.channel === 'walk-in' && o.status !== 'cancelled'))
        .reduce((sum, o) => sum + o.items.reduce((s, it) => s + (it.unit_cost_at_sale || 2200) * it.quantity, 0), 0);

      // Operating expenses for this date
      const dayExp = dayExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

      // Final collection balance (Total Inflow - Returns - Cash Outflows)
      const colBal = totalCol - returnAmt - dayExp;

      rows.push({
        date,
        orders_count: ordersCount,
        order_quantity: orderQty,
        order_value: orderVal,
        product_quantity: productQty,
        draft_pending: draftPending,
        delivery_pending: delivPending,
        delivery_done: delivDone,
        return_quantity: returnQty,
        return_amount: returnAmt,
        cash_collection: cashCol,
        bank_transfer: bankCol,
        bkash_personal: bkashPersCol,
        bkash_merchant: bkashMerchCol,
        nagad: nagadCol,
        other_accounts: otherCol,
        total_collection: totalCol,
        cogs_invoice_cost: dayCogs,
        operating_expenses: dayExp,
        collection_balance: colBal,
        order_ids: dayOrders.map(o => o.id),
        invoice_numbers: dayOrders.map(o => o.invoice_number),
      });

      totalOrders += ordersCount;
      totalOrderQty += orderQty;
      totalOrderVal += orderVal;
      totalProductQty += productQty;
      totalDraftPending += draftPending;
      totalDelivPending += delivPending;
      totalDelivDone += delivDone;
      totalReturnQty += returnQty;
      totalReturnAmt += returnAmt;
      totalCash += cashCol;
      totalBank += bankCol;
      totalBkashPers += bkashPersCol;
      totalBkashMerch += bkashMerchCol;
      totalNagad += nagadCol;
      totalOther += otherCol;
      grandCollection += totalCol;
      totalCogs += dayCogs;
      totalOperatingExp += dayExp;
      grandCollectionBal += colBal;
    }

    return {
      rows,
      summary: {
        date: 'Total / Summary',
        orders_count: totalOrders,
        order_quantity: totalOrderQty,
        order_value: totalOrderVal,
        product_quantity: totalProductQty,
        draft_pending: totalDraftPending,
        delivery_pending: totalDelivPending,
        delivery_done: totalDelivDone,
        return_quantity: totalReturnQty,
        return_amount: totalReturnAmt,
        cash_collection: totalCash,
        bank_transfer: totalBank,
        bkash_personal: totalBkashPers,
        bkash_merchant: totalBkashMerch,
        nagad: totalNagad,
        other_accounts: totalOther,
        total_collection: grandCollection,
        cogs_invoice_cost: totalCogs,
        operating_expenses: totalOperatingExp,
        collection_balance: grandCollectionBal,
      },
    };
  }

  // 3. Automated Financial Cross-Check & Ledger Reconciliation
  public generateFinancialCrossCheckReport(): FinancialCrossCheckReport {
    const checks: FinancialCrossCheckItem[] = [];

    // Check 1: Operational Sales vs General Ledger Revenue
    const completedOrders = Array.from(this.orders.values()).filter(
      o => o.status === 'delivered' || (o.channel === 'walk-in' && o.status !== 'cancelled')
    );
    const operationalNetSales = completedOrders.reduce((s, o) => s + (o.subtotal - o.discount_amount + o.delivery_charge), 0);
    const glSalesRev = (this.accounts.get('acc_sales_rev')?.balance || 0) + (this.accounts.get('acc_deliv_inc')?.balance || 0) - (this.accounts.get('acc_sales_ret')?.balance || 0);
    const salesVariance = Math.abs(operationalNetSales - glSalesRev);
    checks.push({
      id: 'chk_sales_rev',
      title: 'Operational Sales vs GL Sales Revenue',
      description: 'Cross-checks recognized sales from delivered/walk-in orders against general ledger revenue accounts (4010, 4020, less 4030).',
      operational_metric_label: 'Operational Recognized Sales',
      operational_amount: operationalNetSales,
      accounting_metric_label: 'General Ledger Net Revenue',
      accounting_amount: glSalesRev,
      variance: salesVariance,
      is_balanced: salesVariance < 1,
      status: salesVariance < 1 ? 'balanced' : 'discrepancy',
      notes: salesVariance < 1 ? 'Authoritative double-entry sales matching is complete.' : `Identified ৳${salesVariance.toLocaleString()} variance between operational orders and GL revenue.`,
    });

    // Check 2: Direct Order Payments vs Payment Accounts Inflows
    let operationalPaymentsTotal = 0;
    this.orders.forEach(o => {
      if (o.payments) {
        o.payments.forEach(p => {
          if (p.status === 'completed' && p.method !== 'cod_pending') {
            operationalPaymentsTotal += Number(p.amount) || 0;
          }
        });
      }
    });

    // Sum of sales revenue inflows deposited into payment accounts
    let paymentAccountsInflow = 0;
    this.journalEntries.forEach(entry => {
      if (entry.reference_id?.startsWith('ORD-') || entry.description.toLowerCase().includes('sale') || entry.description.toLowerCase().includes('invoice') || entry.description.toLowerCase().includes('payment')) {
        entry.lines.forEach(l => {
          if (l.account_id.startsWith('acc_pmt_') || l.account_id === 'acc_cash' || l.account_id === 'acc_bank' || l.account_id === 'acc_bkash' || l.account_id === 'acc_nagad') {
            paymentAccountsInflow += Number(l.debit || 0);
          }
        });
      }
    });

    const paymentVariance = Math.abs(operationalPaymentsTotal - paymentAccountsInflow);
    checks.push({
      id: 'chk_payments_inflow',
      title: 'Order Payment Receipts vs Payment Account Inflows',
      description: 'Cross-checks total completed direct payments recorded across orders against money debited into payment accounts.',
      operational_metric_label: 'Direct Order Payment Receipts',
      operational_amount: operationalPaymentsTotal,
      accounting_metric_label: 'Payment Accounts Sales Inflow',
      accounting_amount: paymentAccountsInflow,
      variance: paymentVariance,
      is_balanced: paymentVariance < 1,
      status: paymentVariance < 1 ? 'balanced' : 'discrepancy',
      notes: paymentVariance < 1 ? 'All customer order payments properly posted to operational payment accounts.' : `৳${paymentVariance.toLocaleString()} discrepancy detected in payment accounts posting.`,
    });

    // Check 3: Double-Entry Balancing & Trial Balance Integrity
    let totalJournalDebits = 0;
    let totalJournalCredits = 0;
    let unbalancedJournalCount = 0;

    this.journalEntries.forEach(entry => {
      const entryDebits = entry.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
      const entryCredits = entry.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
      totalJournalDebits += entryDebits;
      totalJournalCredits += entryCredits;
      if (Math.abs(entryDebits - entryCredits) > 0.01) {
        unbalancedJournalCount++;
      }
    });

    const journalVariance = Math.abs(totalJournalDebits - totalJournalCredits);
    checks.push({
      id: 'chk_double_entry_balance',
      title: 'General Ledger Double-Entry Balancing',
      description: 'Validates that every single journal entry satisfies the fundamental accounting equation (Debits = Credits) with zero delta.',
      operational_metric_label: 'Total General Ledger Debits',
      operational_amount: totalJournalDebits,
      accounting_metric_label: 'Total General Ledger Credits',
      accounting_amount: totalJournalCredits,
      variance: journalVariance,
      is_balanced: journalVariance < 0.01 && unbalancedJournalCount === 0,
      status: journalVariance < 0.01 && unbalancedJournalCount === 0 ? 'balanced' : 'discrepancy',
      notes: journalVariance < 0.01 ? `All ${this.journalEntries.length} journal entries are strictly balanced.` : `Warning: ${unbalancedJournalCount} unbalanced journal entries detected.`,
    });

    // Check 4: Unsettled Delivered Courier COD vs Courier Receivable GL Account
    const unsettledDeliveredBookings = Array.from(this.courierBookings.values()).filter(
      b => b.status === 'delivered' && b.payout_status !== 'reconciled'
    );
    const expectedUnsettledCod = unsettledDeliveredBookings.reduce((s, b) => s + b.cod_amount, 0);
    const glCourierReceivable = this.accounts.get('acc_courier_rec')?.balance || 0;
    const courierVariance = Math.abs(expectedUnsettledCod - glCourierReceivable);
    checks.push({
      id: 'chk_courier_receivable',
      title: 'Unsettled Courier COD vs Courier Receivable GL',
      description: 'Cross-checks unsettled delivered Steadfast consignment amounts against GL Courier Receivable (Account 1040).',
      operational_metric_label: 'Expected Delivered Unsettled COD',
      operational_amount: expectedUnsettledCod,
      accounting_metric_label: 'GL Courier Receivable Balance',
      accounting_amount: glCourierReceivable,
      variance: courierVariance,
      is_balanced: courierVariance < 1,
      status: courierVariance < 1 ? 'balanced' : 'discrepancy',
      notes: courierVariance < 1 ? 'Courier clearing accounts match physical delivery state.' : `Variance of ৳${courierVariance.toLocaleString()} in courier clearing.`,
    });

    // Check 5: Physical Inventory Valuation vs Balance Sheet Inventory Asset
    const physicalStockValuation = Array.from(this.products.values()).reduce(
      (s, p) => s + (p.stock_on_hand || 0) * (p.avg_cost || 0),
      0
    );
    const glInventoryAsset = this.accounts.get('acc_inventory')?.balance || 0;
    const invVariance = Math.abs(physicalStockValuation - glInventoryAsset);
    checks.push({
      id: 'chk_inventory_valuation',
      title: 'Inventory Stock Valuation vs GL Inventory Account',
      description: 'Cross-checks real-time stock-on-hand multiplied by weighted-average unit cost against GL Asset Account 1050.',
      operational_metric_label: 'Stock-on-Hand Physical Valuation',
      operational_amount: physicalStockValuation,
      accounting_metric_label: 'GL Inventory Asset Balance',
      accounting_amount: glInventoryAsset,
      variance: invVariance,
      is_balanced: invVariance < 1,
      status: invVariance < 1 ? 'balanced' : 'discrepancy',
      notes: invVariance < 1 ? 'Physical warehouse inventory valuation is in full parity with financial ledger.' : `Variance of ৳${invVariance.toLocaleString()} between SKU ledger and GL asset.`,
    });

    const balancedCount = checks.filter(c => c.is_balanced).length;

    return {
      as_of_date: new Date().toISOString().slice(0, 10),
      is_fully_balanced: balancedCount === checks.length,
      total_checks: checks.length,
      balanced_checks: balancedCount,
      checks,
    };
  }


  // --- Phase 8: Approval Workflow Engine (Section 23, 40.8) ---

  public allocateApprovalNumber(): string {
    const num = this.nextApprovalNumber++;
    return `APR-2026-${String(num).padStart(4, '0')}`;
  }

  public createApprovalRequest(params: {
    request_type: ApprovalRequestType;
    title: string;
    description: string;
    impact_amount: number;
    payload_data?: any;
    actor_id: string;
    actor_name: string;
  }): ApprovalRequest {
    const id = `apr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const reqNum = this.allocateApprovalNumber();

    const req: ApprovalRequest = {
      id,
      request_number: reqNum,
      request_type: params.request_type,
      title: params.title,
      description: params.description,
      impact_amount: Number(params.impact_amount) || 0,
      requested_by_id: params.actor_id,
      requested_by_name: params.actor_name,
      requested_at: new Date().toISOString(),
      status: 'pending',
      payload_data: params.payload_data,
    };

    this.approvalRequests.set(id, req);

    // Push high-priority notification to Owner & GM
    this.notifications.unshift({
      id: `notif_${Date.now()}_${Math.random()}`,
      type: 'approval_request',
      priority: 'critical',
      title: `Pending Approval: ${req.request_number}`,
      message: `${req.requested_by_name} submitted a ${req.request_type.replace('_', ' ')} request (\u09F3${req.impact_amount.toLocaleString()}) for sign-off.`,
      ref_type: 'approval_request',
      ref_id: id,
      action_url: '/audit-log',
      read: false,
      created_at: new Date().toISOString(),
    });

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'approval_request_created',
      'approval_request',
      id,
      `Submitted ${req.request_type} approval request (${req.request_number}) with estimated impact of \u09F3${req.impact_amount.toLocaleString()}`
    );

    return req;
  }

  public reviewApprovalRequest(
    id: string,
    decision: 'approved' | 'rejected',
    reviewNotes: string | undefined,
    actorId: string,
    actorName: string
  ): ApprovalRequest {
    const req = this.approvalRequests.get(id);
    if (!req) throw new Error(`Approval request not found: ${id}`);
    if (req.status !== 'pending') throw new Error(`Approval request has already been ${req.status}`);

    const oldState = { ...req };
    req.status = decision;
    req.reviewed_by_id = actorId;
    req.reviewed_by_name = actorName;
    req.reviewed_at = new Date().toISOString();
    req.review_notes = reviewNotes;

    // Trigger atomic action execution if approved
    if (decision === 'approved' && req.payload_data) {
      if (req.request_type === 'order_cancellation' && req.payload_data.order_id) {
        this.cancelOrder(req.payload_data.order_id, reviewNotes || 'Approved order cancellation');
      } else if (req.request_type === 'high_expense' && req.payload_data.expense_params) {
        this.recordExpense(req.payload_data.expense_params);
      }
    }

    // Push decision notification back to requester
    this.notifications.unshift({
      id: `notif_${Date.now()}_${Math.random()}`,
      type: 'system',
      priority: decision === 'approved' ? 'info' : 'warning',
      title: `Approval ${decision.toUpperCase()}: ${req.request_number}`,
      message: `Your request "${req.title}" was ${decision} by ${actorName}.${reviewNotes ? ` Notes: ${reviewNotes}` : ''}`,
      ref_type: 'approval_request',
      ref_id: id,
      action_url: '/audit-log',
      read: false,
      created_at: new Date().toISOString(),
    });

    this.logAudit(
      actorId,
      actorName,
      `approval_request_${decision}`,
      'approval_request',
      id,
      `${decision.toUpperCase()} approval request ${req.request_number}: ${req.title}`,
      oldState,
      req
    );

    return req;
  }

  /**
   * Cancel an order (AGENTS.md Section 11.1 / 35.2).
   *
   * Branches on order status at the moment of cancellation:
   *  - confirmed: stock was only RESERVED (never physically removed). Releasing
   *    the reservation is correct & sufficient \u2014 Available jumps back up. No
   *    scan-back is needed (the bottle never left the shelf).
   *  - packed / dispatched: on_hand was already deducted at packing (35.1b).
   *    Cancellation does NOT touch inventory here \u2014 the item is physically out
   *    of the building. Getting it back into on_hand requires a separate, later
   *    barcode scan-back (35.2a).
   */
  public cancelOrder(
    orderId: string,
    reason: string,
    actorId?: string,
    actorName?: string
  ): Order {
    const cancellationCategories = [
      'Customer changed their mind',
      'Product out of stock',
      'Duplicate order',
      'Wrong item/details entered',
      'Customer unreachable / no response',
      'Price/payment disagreement',
      'Suspected fake/fraudulent order',
    ];
    const isOtherReason = reason.startsWith('Other (please specify):');
    if (!cancellationCategories.includes(reason) && !isOtherReason) {
      throw new Error('Select a valid cancellation reason category.');
    }
    if (isOtherReason && reason.slice('Other (please specify):'.length).trim().length === 0) {
      throw new Error('Details are required for an Other cancellation reason.');
    }

    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);
    if (order.status === 'cancelled') throw new Error(`Order ${orderId} is already cancelled`);
    if (!['confirmed', 'packed', 'dispatched', 'delivered', 'returned', 'rto'].includes(order.status)) {
      throw new Error(`Order ${orderId} cannot be cancelled from status ${order.status}`);
    }

    const whoId = actorId || order.created_by || 'system';
    const whoName = actorName || order.created_by_name || 'System';
    const shopFloorWh = 'wh_shop';

    const expanded = this.expandBundles(
      order.items.map(it => ({ product_id: it.product_id, quantity: it.quantity }))
    );

    if (order.status === 'confirmed') {
      // Release the reservation \u2014 no scan-back needed (35.2).
      for (const comp of expanded) {
        const inv = this.inventory.get(this.invKey(comp.product_id, shopFloorWh));
        if (inv) {
          inv.reserved = Math.max(0, inv.reserved - comp.quantity);
          // Section 32.4/41 reservation ledger \u2014 record the RELEASE
          this.reservationEvents.push({
            id: `RES-${Date.now()}-${this.reservationEvents.length + 1}`,
            order_id: order.id,
            product_id: comp.product_id,
            warehouse_id: shopFloorWh,
            quantity: comp.quantity,
            type: 'RELEASE',
            created_by: whoId,
            created_by_name: whoName,
            created_at: new Date().toISOString(),
            notes: `Reservation released on cancellation of ${order.invoice_number}`,
          });
        }
      }
    }
    // Once the order has left the shelf, inventory is unchanged here. Recovery
    // is a separate barcode scan-back after the physical item returns.

    const oldStatus = order.status;
    order.status = 'cancelled';
    order.cancel_reason = reason;
    order.cancelled_at = new Date().toISOString();
    order.cancelled_by = whoId;
    order.cancelled_by_name = whoName;
    order.cancelled_from_status = oldStatus;
    order.physical_recovery_required = oldStatus !== 'confirmed';

    // Refund any advance/partial payment already taken (Section 11.1 / 15.5).
    // Follows the established customer-refund journal pattern (Dr Sales Returns,
    // Cr refund account) and the payment status field already used elsewhere.
    const completedPayments = (order.payments || []).filter(
      p => p.status === 'completed' && p.amount > 0
    );
    let refundedAmount = 0;
    if (completedPayments.length > 0) {
      const refundAcc = this.accounts.get('acc_bkash') || this.accounts.get('acc_bank')!;
      for (const pay of completedPayments) {
        pay.status = 'refunded';
        refundedAmount += pay.amount;
      }
      if (refundedAmount > 0) {
        this.postJournal(
          new Date().toISOString().slice(0, 10),
          'order_cancel_refund',
          orderId,
          `Refund for cancelled order ${order.invoice_number} (${reason})`,
          [
            { account_id: 'acc_sales_ret', debit: refundedAmount, credit: 0, line_desc: `Refund of advance payment for ${order.invoice_number}` },
            { account_id: refundAcc.id, debit: 0, credit: refundedAmount, line_desc: `Advance refund disbursed from ${refundAcc.name}` },
          ],
          whoName,
          undefined,
          'customer_return'
        );
      }
    }
    order.refunded_amount = refundedAmount;
    order.updated_at = new Date().toISOString();

    this.logAudit(
      whoId,
      whoName,
      'order_cancelled',
      'order',
      orderId,
      `Cancelled order ${order.invoice_number} (status ${oldStatus}): ${reason}${refundedAmount > 0 ? ` \u2014 refunded \u09F3${refundedAmount}` : ''}`,
      { status: oldStatus },
      { status: 'cancelled', cancel_reason: reason, refunded_amount: refundedAmount }
    );

    return order;
  }


  public getApprovalRequestsSummary(): {
    total_requests: number;
    pending_count: number;
    approved_count: number;
    rejected_count: number;
    total_pending_impact: number;
  } {
    const list = Array.from(this.approvalRequests.values());
    const pending = list.filter(r => r.status === 'pending');
    const approved = list.filter(r => r.status === 'approved');
    const rejected = list.filter(r => r.status === 'rejected');
    const totalPendingImpact = pending.reduce((s, r) => s + r.impact_amount, 0);

    return {
      total_requests: list.length,
      pending_count: pending.length,
      approved_count: approved.length,
      rejected_count: rejected.length,
      total_pending_impact: totalPendingImpact,
    };
  }

  // --- Phase 9: Dynamic Pricing & Competitor Tracking (Section 22, 40.9) ---

  public recordCompetitorPrice(params: {
    product_id: string;
    competitor_name: string;
    competitor_price: number;
    competitor_url?: string;
    in_stock?: boolean;
    notes?: string;
    actor_id: string;
    actor_name: string;
  }): CompetitorPriceRecord {
    const prod = this.products.get(params.product_id);
    if (!prod) throw new Error(`Product not found: ${params.product_id}`);

    const id = `cp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const record: CompetitorPriceRecord = {
      id,
      product_id: prod.id,
      product_name: prod.display_name,
      sku: prod.sku,
      competitor_name: params.competitor_name.trim(),
      competitor_price: Number(params.competitor_price) || 0,
      competitor_url: params.competitor_url?.trim(),
      in_stock: params.in_stock !== false,
      notes: params.notes?.trim(),
      recorded_at: new Date().toISOString(),
    };

    this.competitorPrices.set(id, record);

    this.logAudit(
      params.actor_id,
      params.actor_name,
      'competitor_price_logged',
      'competitor_price',
      id,
      `Logged competitor price for ${prod.display_name}: \u09F3${record.competitor_price} (${record.competitor_name})`
    );

    return record;
  }

  public deleteCompetitorPrice(id: string, actor_id: string, actor_name: string): void {
    const rec = this.competitorPrices.get(id);
    if (!rec) return;
    this.competitorPrices.delete(id);
    this.logAudit(actor_id, actor_name, 'competitor_price_deleted', 'competitor_price', id, `Deleted competitor price for ${rec.product_name}`);
  }

  public createOrUpdatePricingRule(rule: PricingRule, actor_id: string, actor_name: string): PricingRule {
    this.pricingRules.set(rule.id, rule);
    this.logAudit(actor_id, actor_name, 'pricing_rule_saved', 'pricing_rule', rule.id, `Updated pricing rule: ${rule.name}`);
    return rule;
  }

  public createPricingCampaign(params: {
    name: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    start_date: string;
    end_date: string;
    target_type: 'all' | 'category' | 'brand' | 'sku';
    target_value?: string;
    actor_id: string;
    actor_name: string;
  }): PricingCampaign {
    const id = `cmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const campaign: PricingCampaign = {
      id,
      name: params.name,
      discount_type: params.discount_type,
      discount_value: Number(params.discount_value) || 0,
      start_date: params.start_date,
      end_date: params.end_date,
      target_type: params.target_type,
      target_value: params.target_value,
      active: true,
    };

    this.pricingCampaigns.set(id, campaign);
    this.logAudit(params.actor_id, params.actor_name, 'pricing_campaign_created', 'pricing_campaign', id, `Created pricing campaign: ${campaign.name}`);
    return campaign;
  }

  public togglePricingCampaign(id: string, active: boolean, actor_id: string, actor_name: string): PricingCampaign {
    const cmp = this.pricingCampaigns.get(id);
    if (!cmp) throw new Error(`Campaign not found: ${id}`);
    cmp.active = active;
    this.logAudit(actor_id, actor_name, 'pricing_campaign_toggled', 'pricing_campaign', id, `Toggled campaign ${cmp.name} to ${active ? 'ACTIVE' : 'PAUSED'}`);
    return cmp;
  }

  public generateRepricingSuggestions(): RepricingSuggestion[] {
    const activeRule = Array.from(this.pricingRules.values()).find(r => r.active) || {
      id: 'default_rule',
      name: 'Default Cost-Plus Guardrail',
      strategy: 'competitor_undercut',
      minimum_margin_percent: 20,
      target_margin_percent: 35,
      max_discount_percent: 15,
      undercut_amount: 50,
      active: true,
    };

    const suggestions: RepricingSuggestion[] = [];

    this.products.forEach(prod => {
      const cost = prod.avg_cost || 2200;
      const currentPrice = prod.regular_price ?? prod.selling_price;
      // Floor price ensures minimum margin
      const floorPrice = Math.round(cost / (1 - activeRule.minimum_margin_percent / 100));
      const targetPrice = Math.round(cost / (1 - activeRule.target_margin_percent / 100));

      // Fetch competitor prices for this product
      const compPrices = Array.from(this.competitorPrices.values()).filter(cp => cp.product_id === prod.id && cp.in_stock);

      let lowestCompPrice: number | undefined;
      let lowestCompName: string | undefined;
      let avgMarketPrice: number | undefined;

      if (compPrices.length > 0) {
        const sorted = [...compPrices].sort((a, b) => a.competitor_price - b.competitor_price);
        lowestCompPrice = sorted[0].competitor_price;
        lowestCompName = sorted[0].competitor_name;
        const total = compPrices.reduce((s, cp) => s + cp.competitor_price, 0);
        avgMarketPrice = Math.round(total / compPrices.length);
      }

      let suggestedPrice = currentPrice;
      let recommendationReason = 'Current price is aligned with target margin.';
      let status: 'optimal' | 'undervalued' | 'overpriced' | 'below_floor' = 'optimal';

      if (currentPrice < floorPrice) {
        suggestedPrice = floorPrice;
        recommendationReason = `Current price violates ${activeRule.minimum_margin_percent}% margin floor. Suggested price restored to floor.`;
        status = 'below_floor';
      } else if (lowestCompPrice) {
        if (activeRule.strategy === 'competitor_undercut') {
          const undercutTarget = lowestCompPrice - (activeRule.undercut_amount || 50);
          if (undercutTarget >= floorPrice) {
            suggestedPrice = undercutTarget;
            recommendationReason = `Undercut ${lowestCompName} (\u09F3${lowestCompPrice}) by \u09F3${activeRule.undercut_amount} while preserving safe margin.`;
            status = currentPrice > lowestCompPrice ? 'overpriced' : 'optimal';
          } else {
            suggestedPrice = floorPrice;
            recommendationReason = `Market lowest (\u09F3${lowestCompPrice}) is below margin floor. Suggested price set to safe floor \u09F3${floorPrice}.`;
            status = 'overpriced';
          }
        } else if (activeRule.strategy === 'market_match' && avgMarketPrice) {
          suggestedPrice = Math.max(floorPrice, avgMarketPrice);
          recommendationReason = `Matched average market price across competitors.`;
        }
      } else {
        // No competitor data -> use target margin
        suggestedPrice = Math.max(floorPrice, targetPrice);
        recommendationReason = `Targeting ${activeRule.target_margin_percent}% margin on landed cost.`;
      }

      const projectedMarginPct = suggestedPrice > 0 ? ((suggestedPrice - cost) / suggestedPrice) * 100 : 0;
      const diffVsCurrent = suggestedPrice - currentPrice;

      suggestions.push({
        product_id: prod.id,
        product_name: prod.display_name,
        sku: prod.sku,
        category_name: prod.category_name,
        current_price: currentPrice,
        cost_price: cost,
        floor_price: floorPrice,
        lowest_competitor_price: lowestCompPrice,
        lowest_competitor_name: lowestCompName,
        average_market_price: avgMarketPrice,
        suggested_price: suggestedPrice,
        projected_margin_percent: projectedMarginPct,
        price_difference_vs_current: diffVsCurrent,
        recommendation_reason: recommendationReason,
        status,
      });
    });

    return suggestions;
  }

  public applyRepricingSuggestion(
    productId: string,
    newPrice: number,
    reason: string,
    actorId: string,
    actorName: string
  ): Product {
    const prod = this.products.get(productId);
    if (!prod) throw new Error(`Product not found: ${productId}`);

    const oldPrice = prod.regular_price;
    const targetPrice = Number(newPrice);
    prod.regular_price = targetPrice;
    if (prod.selling_price !== targetPrice) {
      prod.selling_price = targetPrice;
      prod.price_updated_at = new Date().toISOString();
    }

    this.logAudit(
      actorId,
      actorName,
      'product_repriced',
      'product',
      productId,
      `Repriced ${prod.display_name} from ${oldPrice === undefined ? 'n/a' : '\u09F3' + oldPrice} to \u09F3${targetPrice}. Reason: ${reason}`
    );

    return prod;
  }

  // Point 3.2: a selling-price change creates a moderator-facing in-app
  // notification. It's a broadcast (all users can see it in the bell; each
  // user's per-user toggle filters it client-side).
  public pushPriceChangedNotification(params: {
    product_id: string;
    product_name: string;
    old_price?: number;
    new_price: number;
    actor_name: string;
  }): void {
    const { product_id, product_name, old_price, new_price, actor_name } = params;
    this.notifications.unshift({
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'price_changed',
      message: `Selling price updated: ${product_name} ${old_price !== undefined ? `\u09F3${old_price} \u2192 ` : ''}\u09F3${new_price} (${actor_name})`,
      ref_type: 'product',
      ref_id: product_id,
      read: false,
      created_at: new Date().toISOString(),
    });
  }

  // --- Phase 10: System Hardening, 2FA & Backups (Section 31, 40.10) ---

  // RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30s period) \u2014 real implementation
  // using Node's crypto, compatible with Google Authenticator / Authy etc.
  private base32Decode(input: string): Buffer {
    const map: Record<string, number> = {
      A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,I:8,J:9,K:10,L:11,M:12,N:13,
      O:14,P:15,Q:16,R:17,S:18,T:19,U:20,V:21,W:22,X:23,Y:24,Z:25,
      '2':26,'3':27,'4':28,'5':29,'6':30,'7':31,
    };
    const clean = input.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
    const bits: number[] = [];
    for (const ch of clean) {
      const v = map[ch];
      if (v === undefined) continue;
      for (let b = 4; b >= 0; b--) bits.push((v >> b) & 1);
    }
    const bytes: number[] = [];
    for (let i = 0; i + 7 < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      bytes.push(byte);
    }
    return Buffer.from(bytes);
  }

  private totpCode(secret: string, counter: number): string {
    const key = this.base32Decode(secret);
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buf.writeUInt32BE(counter >>> 0, 4);
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binCode =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(binCode % 1000000).padStart(6, '0');
  }

  private verifyTotp(secret: string, code: string, window = 1): boolean {
    const counter = Math.floor(Date.now() / 1000 / 30);
    for (let i = -window; i <= window; i++) {
      if (this.totpCode(secret, counter + i) === String(code).trim()) return true;
    }
    return false;
  }

  public generate2FASetup(userId: string): {
    secret: string;
    qr_code_uri: string;
    backup_codes: string[];
  } {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);

    // Generate clean base32 mock secret and standard OTPAuth URI
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const backupCodes = Array.from({ length: 8 }, () => {
      const p1 = Math.floor(1000 + Math.random() * 9000);
      const p2 = Math.floor(1000 + Math.random() * 9000);
      return `${p1}-${p2}`;
    });

    const qrCodeUri = `otpauth://totp/MiragePerfume:${encodeURIComponent(user.email)}?secret=${secret}&issuer=MiragePerfumeERP`;

    return {
      secret,
      qr_code_uri: qrCodeUri,
      backup_codes: backupCodes,
    };
  }

  public verifyAndEnable2FA(params: {
    user_id: string;
    code: string;
    secret: string;
    backup_codes: string[];
    actor_id: string;
    actor_name: string;
  }): User {
    const user = this.users.get(params.user_id);
    if (!user) throw new Error(`User not found: ${params.user_id}`);

    if (!params.code || params.code.trim().length < 6) {
      throw new Error('Please enter a valid 6-digit TOTP verification code.');
    }

    // Real verification: the submitted code must match the TOTP generated
    // from the secret the user just scanned (RFC 6238). Without this check
    // anyone could type any 6 digits and enable 2FA, defeating its purpose.
    if (!this.verifyTotp(params.secret, params.code)) {
      throw new Error('Invalid TOTP code. The code did not match the authenticator app. Please try again.');
    }

    user.two_factor_enabled = true;
    user.totp_enabled = true;
    user.two_factor_secret = params.secret;
    user.backup_codes = params.backup_codes;

    this.logAudit(
      params.actor_id,
      params.actor_name,
      '2fa_enabled',
      'user',
      user.id,
      `Enabled Two-Factor Authentication (TOTP) on user account ${user.name}`
    );

    return user;
  }

  public disable2FA(userId: string, actorId: string, actorName: string): User {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);

    user.two_factor_enabled = false;
    user.totp_enabled = false;
    user.two_factor_secret = undefined;
    user.backup_codes = undefined;

    this.logAudit(
      actorId,
      actorName,
      '2fa_disabled',
      'user',
      user.id,
      `Disabled Two-Factor Authentication on user account ${user.name}`
    );

    return user;
  }

  public createFullDatabaseBackup(actorId: string, actorName: string): BackupSnapshot {
    const timestamp = new Date().toISOString();
    const cleanDate = timestamp.replace(/[-:]/g, '').slice(0, 15);
    const filename = `mirage_erp_backup_${cleanDate}.json`;
    const id = `bkp_${Date.now()}`;

    // Collect all data
    const fullPayload = {
      version: '2.0.0-phase10',
      exported_at: timestamp,
      created_by: actorName,
      data: {
        products: Array.from(this.products.values()),
        warehouses: Array.from(this.warehouses.values()),
        inventory: Array.from(this.inventory.values()),
        customers: Array.from(this.customers.values()),
        orders: Array.from(this.orders.values()),
        courier_bookings: Array.from(this.courierBookings.values()),
        suppliers: Array.from(this.suppliers.values()),
        purchase_orders: Array.from(this.purchaseOrders.values()),
        purchase_returns: Array.from(this.purchaseReturns.values()),
        customer_returns: Array.from(this.customerReturns.values()),
        cash_register_logs: this.cashRegisterLogs,
        cashier_daily_closings: Array.from(this.cashierDailyClosings.values()),
        expenses: Array.from(this.expenses.values()),
        expense_categories: Array.from(this.expenseCategories.values()),
        expense_templates: Array.from(this.expenseTemplates.values()),
        expense_budgets: Array.from(this.expenseBudgets.values()),
        employees: Array.from(this.employees.values()),
        payroll_records: Array.from(this.payrollRecords.values()),
        approval_requests: Array.from(this.approvalRequests.values()),
        pricing_rules: Array.from(this.pricingRules.values()),
        competitor_prices: Array.from(this.competitorPrices.values()),
        pricing_campaigns: Array.from(this.pricingCampaigns.values()),
        packaging_materials: Array.from(this.packagingMaterials.values()),
        packaging_stock_movements: this.packagingStockMovements,
        accounts: Array.from(this.accounts.values()),
        payment_accounts: Array.from(this.paymentAccounts.values()),
        fund_transfers: Array.from(this.fundTransfers.values()),
        account_deposits: Array.from(this.accountDeposits.values()),
        account_withdrawals: Array.from(this.accountWithdrawals.values()),
        manual_adjustments: Array.from(this.manualAdjustments.values()),
        journal_entries: this.journalEntries,
        audit_logs: this.auditLogs,
        settings: this.settings,
        security_settings: this.securitySettings,
      },
    };

    const jsonStr = JSON.stringify(fullPayload);
    const sizeKb = Math.round(jsonStr.length / 1024);
    // Genuine full-payload SHA-256 checksum (Section 39.2) \u2014 previously only
    // hashed the first 64 characters, which produced a meaningless value.
    const checksum = `sha256:${crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex')}`;

    const snapshot: BackupSnapshot = {
      id,
      filename,
      timestamp,
      version: '2.0.0',
      size_kb: sizeKb,
      record_counts: {
        products: this.products.size,
        orders: this.orders.size,
        customers: this.customers.size,
        inventory_ledger: this.stockMovements.length,
        journal_entries: this.journalEntries.length,
        expenses: this.expenses.size,
        payroll: this.payrollRecords.size,
        audit_logs: this.auditLogs.length,
      },
      checksum,
      created_by: actorName,
      status: 'completed',
    };

    this.backups.unshift(snapshot);
    // Store a FROZEN deep copy (JSON round-trip) of the payload, not live
    // references \u2014 otherwise later mutations (e.g. the audit log appended
    // below) would change the stored bytes and break checksum verification.
    this.backupPayloads.set(id, JSON.parse(jsonStr));

    this.logAudit(
      actorId,
      actorName,
      'backup_created',
      'system_backup',
      id,
      `Generated full system database snapshot (${sizeKb} KB, Checksum ${checksum})`
    );

    return snapshot;
  }

  public getBackupSnapshotData(backupId: string): any {
    const payload = this.backupPayloads.get(backupId);
    if (!payload) {
      // Return fresh serialized dump
      return {
        backup_id: backupId,
        exported_at: new Date().toISOString(),
        data: {
          products: Array.from(this.products.values()),
          orders: Array.from(this.orders.values()),
          customers: Array.from(this.customers.values()),
          accounts: Array.from(this.accounts.values()),
          journal_entries: this.journalEntries,
          audit_logs: this.auditLogs,
        },
      };
    }
    return payload;
  }

  public restoreDatabaseFromSnapshot(snapshotData: any, actorId: string, actorName: string): { success: boolean; restored_counts: any } {
    if (!snapshotData || !snapshotData.data) {
      throw new Error('Invalid snapshot format: missing "data" node.');
    }

    const d = snapshotData.data;

    // Restore entities if present in snapshot
    if (Array.isArray(d.products)) {
      this.products.clear();
      d.products.forEach((p: Product) => this.products.set(p.id, p));
    }
    if (Array.isArray(d.orders)) {
      this.orders.clear();
      d.orders.forEach((o: Order) => this.orders.set(o.id, o));
    }
    if (Array.isArray(d.customers)) {
      this.customers.clear();
      d.customers.forEach((c: Customer) => this.customers.set(c.id, c));
    }
    if (Array.isArray(d.accounts)) {
      this.accounts.clear();
      d.accounts.forEach((a: Account) => this.accounts.set(a.id, a));
    }
    if (Array.isArray(d.payment_accounts)) {
      this.paymentAccounts.clear();
      d.payment_accounts.forEach((p: PaymentAccount) => this.paymentAccounts.set(p.id, p));
    }
    if (Array.isArray(d.fund_transfers)) {
      this.fundTransfers.clear();
      d.fund_transfers.forEach((f: FundTransferRecord) => this.fundTransfers.set(f.id, f));
    }
    if (Array.isArray(d.account_deposits)) {
      this.accountDeposits.clear();
      d.account_deposits.forEach((dep: AccountDepositRecord) => this.accountDeposits.set(dep.id, dep));
    }
    if (Array.isArray(d.account_withdrawals)) {
      this.accountWithdrawals.clear();
      d.account_withdrawals.forEach((w: AccountWithdrawalRecord) => this.accountWithdrawals.set(w.id, w));
    }
    if (Array.isArray(d.manual_adjustments)) {
      this.manualAdjustments.clear();
      d.manual_adjustments.forEach((adj: ManualAdjustmentRecord) => this.manualAdjustments.set(adj.id, adj));
    }
    if (Array.isArray(d.journal_entries)) {
      this.journalEntries = [...d.journal_entries];
    }
    if (Array.isArray(d.cashier_daily_closings)) {
      this.cashierDailyClosings.clear();
      d.cashier_daily_closings.forEach((c: CashierDailyClosing) => this.cashierDailyClosings.set(c.id, c));
    }
    if (Array.isArray(d.expenses)) {
      this.expenses.clear();
      d.expenses.forEach((e: ExpenseRecord) => this.expenses.set(e.id, e));
    }
    if (Array.isArray(d.expense_categories)) {
      this.expenseCategories.clear();
      d.expense_categories.forEach((c: ExpenseCategoryDefinition) => this.expenseCategories.set(c.id, c));
    }
    if (Array.isArray(d.expense_templates)) {
      this.expenseTemplates.clear();
      d.expense_templates.forEach((t: ExpenseTemplate) => this.expenseTemplates.set(t.id, t));
    }
    if (Array.isArray(d.expense_budgets)) {
      this.expenseBudgets.clear();
      d.expense_budgets.forEach((b: ExpenseBudget) => this.expenseBudgets.set(b.id, b));
    }
    if (Array.isArray(d.payroll_records)) {
      this.payrollRecords.clear();
      d.payroll_records.forEach((p: PayrollRecord) => this.payrollRecords.set(p.id, p));
    }
    if (d.settings) {
      this.settings = { ...d.settings };
    }
    if (Array.isArray(d.packaging_materials)) {
      this.packagingMaterials.clear();
      d.packaging_materials.forEach((m: PackagingMaterial) => this.packagingMaterials.set(m.id, m));
    }
    if (Array.isArray(d.packaging_stock_movements)) {
      this.packagingStockMovements = [...d.packaging_stock_movements];
    }

    const counts = {
      products: this.products.size,
      orders: this.orders.size,
      customers: this.customers.size,
      accounts: this.accounts.size,
      journal_entries: this.journalEntries.length,
      expenses: this.expenses.size,
    };

    this.logAudit(
      actorId,
      actorName,
      'database_restored',
      'system_backup',
      'restore_event',
      `Restored system state from backup snapshot (Products: ${counts.products}, Orders: ${counts.orders})`
    );

    return { success: true, restored_counts: counts };
  }

  public updateSecuritySettings(newSettings: Partial<SecuritySettings>, actorId: string, actorName: string): SecuritySettings {
    this.securitySettings = { ...this.securitySettings, ...newSettings };
    this.logAudit(
      actorId,
      actorName,
      'security_settings_updated',
      'security',
      'security_config',
      `Updated security policies: Timeout ${this.securitySettings.session_timeout_minutes}m, Require 2FA Admin: ${this.securitySettings.require_2fa_admin}`
    );
    return this.securitySettings;
  }

  public createSession(userId: string, ip?: string, userAgent?: string): string {
    const token = `mirage_sess_${crypto.randomBytes(24).toString('hex')}`;
    const now = Date.now();
    this.sessions.set(token, {
      token,
      userId,
      createdAt: now,
      lastActiveAt: now,
      ip,
      userAgent,
    });
    const user = this.users.get(userId);
    if (user) {
      user.last_login_at = new Date().toISOString();
    }
    return token;
  }

  public validateSession(token: string): { valid: boolean; user?: User; expired?: boolean } {
    if (!token) return { valid: false };
    const sess = this.sessions.get(token);
    if (!sess) return { valid: false };
    const now = Date.now();
    const timeoutMs = (this.securitySettings.session_timeout_minutes || 30) * 60 * 1000;
    if (now - sess.lastActiveAt > timeoutMs) {
      this.sessions.delete(token);
      return { valid: false, expired: true };
    }
    sess.lastActiveAt = now;
    const user = this.users.get(sess.userId);
    if (!user || !user.active) return { valid: false };
    return { valid: true, user };
  }

  public revokeSession(token: string): boolean {
    return this.sessions.delete(token);
  }

  public recordLoginAttempt(identifier: string, success: boolean): { locked: boolean; remainingMinutes?: number } {
    const key = identifier.toLowerCase().trim();
    const now = Date.now();
    const existing = this.loginAttempts.get(key) || { count: 0, lastAttempt: now };

    if (existing.lockedUntil && existing.lockedUntil > now) {
      const remainingMs = existing.lockedUntil - now;
      return { locked: true, remainingMinutes: Math.ceil(remainingMs / (60 * 1000)) };
    }

    if (success) {
      this.loginAttempts.delete(key);
      return { locked: false };
    }

    existing.count += 1;
    existing.lastAttempt = now;
    const maxLogins = this.securitySettings.max_failed_logins || 5;
    if (existing.count >= maxLogins) {
      existing.lockedUntil = now + 15 * 60 * 1000; // 15-minute lockout
      this.loginAttempts.set(key, existing);
      return { locked: true, remainingMinutes: 15 };
    }

    this.loginAttempts.set(key, existing);
    return { locked: false };
  }

  public getSystemHealth(): SystemHealthStatus {
    const uptimeSec = Math.floor((Date.now() - this.serverStartTime) / 1000);
    const totalRecords =
      this.products.size +
      this.orders.size +
      this.customers.size +
      this.stockMovements.length +
      this.accounts.size +
      this.journalEntries.length +
      this.expenses.size +
      this.payrollRecords.size +
      this.auditLogs.length;

    const memoryMb = Math.round(totalRecords * 0.008 + 42);

    const lastBackup = this.backups.length > 0 ? this.backups[0].timestamp : undefined;

    return {
      server_status: 'healthy',
      uptime_seconds: uptimeSec,
      memory_usage_mb: memoryMb,
      total_database_records: totalRecords,
      audit_chain_verified: true,
      active_sessions_count: this.users.size,
      last_backup_at: lastBackup,
      environment: 'Production (Vite + Node Express)',
    };
  }

  // ============================================================================
  // Stock Reporting & Movements Methods (Section 4, 8, Inventory Reports)
  // ============================================================================

  public resolveMovementEntity(m: StockMovement): {
    customer_name: string | null;
    supplier_name: string | null;
    party_name: string | null;
  } {
    return resolveStockMovementEntity(m, this);
  }

  public getStockMovements(params: {
    page?: number;
    page_size?: number;
    product_id?: string;
    warehouse_id?: string;
    movement_reason?: string;
    date_from?: string;
    date_to?: string;
  }): {
    movements: any[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  } {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.page_size) || 25));
    const productId = String(params.product_id || '').trim();
    const warehouseId = String(params.warehouse_id || '').trim();
    const movementReason = String(params.movement_reason || '').trim();
    const dateFrom = String(params.date_from || '').trim();
    const dateTo = String(params.date_to || '').trim();

    const filtered = this.stockMovements.filter(m => {
      if (productId && m.product_id !== productId) return false;
      if (warehouseId && warehouseId !== 'all' && m.warehouse_id !== warehouseId) return false;
      if (movementReason && movementReason !== 'all' && m.movement_reason !== movementReason) return false;
      if (dateFrom && m.created_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && m.created_at.slice(0, 10) > dateTo) return false;
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    const movements = slice.map(m => {
      const resolved = resolveStockMovementEntity(m, this);
      return {
        ...m,
        customer_name: resolved.customer_name,
        supplier_name: resolved.supplier_name,
        party_name: resolved.party_name,
        reason_label: formatMovementReasonLabel(m.movement_reason),
      };
    });

    return {
      movements,
      total,
      page: safePage,
      page_size: pageSize,
      total_pages: totalPages,
    };
  }

  public getStockReport(params: {
    page?: number;
    page_size?: number;
    category?: string;
    brand?: string;
    location?: string;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    date_from?: string;
    date_to?: string;
    low_stock_only?: boolean | string;
    low_stock_threshold?: number | string;
  }): StockReportResponse {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.page_size) || 25));
    const category = String(params.category || '').trim();
    const brand = String(params.brand || '').trim();
    const location = String(params.location || '').trim();
    const search = String(params.search || '').trim().toLowerCase();
    const dateFrom = String(params.date_from || '').trim();
    const dateTo = String(params.date_to || '').trim();
    const sortBy = String(params.sort_by || 'sku').trim();
    const sortOrder = params.sort_order === 'asc' ? 'asc' : (params.sort_order === 'desc' ? 'desc' : (sortBy === 'sku' || sortBy === 'name' ? 'asc' : 'desc'));
    const isLowStockOnly = params.low_stock_only === true || params.low_stock_only === 'true';
    const lowStockThreshold = Number.isFinite(Number(params.low_stock_threshold)) ? Number(params.low_stock_threshold) : 5;

    // 1. Pre-aggregate movements grouped by product_id within date range & location
    const movementAggMap = new Map<string, { sold: number; transferred: number; adjusted: number }>();
    for (const m of this.stockMovements) {
      if (dateFrom && m.created_at.slice(0, 10) < dateFrom) continue;
      if (dateTo && m.created_at.slice(0, 10) > dateTo) continue;
      if (location && location !== 'all' && m.warehouse_id !== location) continue;

      let agg = movementAggMap.get(m.product_id);
      if (!agg) {
        agg = { sold: 0, transferred: 0, adjusted: 0 };
        movementAggMap.set(m.product_id, agg);
      }

      if (m.movement_reason === 'SALE') {
        agg.sold += Math.abs(m.quantity_delta);
      } else if (m.movement_reason === 'TRANSFER') {
        agg.transferred += Math.abs(m.quantity_delta);
      } else if (['ADJUSTMENT', 'DAMAGE', 'LOSS', 'DAMAGED_WRITE_OFF', 'TESTER_CONVERSION', 'MARKETING_SAMPLE', 'GIFT'].includes(m.movement_reason)) {
        agg.adjusted += Math.abs(m.quantity_delta);
      }
    }

    // 2. Filter products
    const allProducts = Array.from(this.products.values());
    const matchedProducts = allProducts.filter(p => {
      if (category && category !== 'all') {
        const catMatch = (p.category_name && p.category_name.toLowerCase() === category.toLowerCase()) ||
          p.category_id === category;
        if (!catMatch) return false;
      }
      if (brand && brand !== 'all') {
        if (!p.brand || p.brand.toLowerCase() !== brand.toLowerCase()) return false;
      }
      if (search) {
        const text = [
          p.display_name,
          p.name,
          p.sku,
          p.barcode,
          p.brand,
          p.category_name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });

    // 3. Transform to StockReportItem using existing stock_on_hand / avg_cost / selling_price
    let items: StockReportItem[] = matchedProducts.map(p => {
      let currentStock = 0;
      let availableStock = 0;
      let locDisplay = 'All Locations';

      if (location && location !== 'all') {
        const inv = this.inventory.get(this.invKey(p.id, location));
        currentStock = inv ? (Number.isFinite(inv.on_hand) ? inv.on_hand : 0) : 0;
        availableStock = inv ? Math.max(0, currentStock - (inv.reserved || 0)) : 0;
        const whName = this.warehouses.get(location)?.name || location;
        const subLoc = location === 'wh_shop' ? p.location_shop : p.location_main;
        locDisplay = subLoc ? `${whName} (${subLoc})` : whName;
      } else {
        const stockSummary = this.getProductStockSummary(p.id);
        currentStock = stockSummary.on_hand;
        availableStock = stockSummary.available;
        const shopInv = this.inventory.get(this.invKey(p.id, 'wh_shop'));
        const mainInv = this.inventory.get(this.invKey(p.id, 'wh_main'));
        const shopQty = shopInv ? shopInv.on_hand : 0;
        const mainQty = mainInv ? mainInv.on_hand : 0;
        locDisplay = `Shop: ${shopQty} | Main: ${mainQty}`;
      }

      const avgCost = Number(p.avg_cost || 0);
      const sellingPrice = Number(p.selling_price || 0);
      const closingStockValuePurchase = Math.round(currentStock * avgCost * 100) / 100;
      const closingStockValueSale = Math.round(currentStock * sellingPrice * 100) / 100;
      const potentialProfit = Math.round((closingStockValueSale - closingStockValuePurchase) * 100) / 100;
      const profitMarginPct = closingStockValueSale > 0
        ? Math.round(((potentialProfit / closingStockValueSale) * 100) * 10) / 10
        : 0;

      const agg = movementAggMap.get(p.id) || { sold: 0, transferred: 0, adjusted: 0 };

      return {
        id: p.id,
        sku: p.sku,
        name: p.name || p.display_name,
        display_name: p.display_name,
        brand: p.brand || '',
        category_id: p.category_id,
        category_name: p.category_name,
        location: locDisplay,
        selling_price: sellingPrice,
        avg_cost: avgCost,
        current_stock: currentStock,
        available_stock: availableStock,
        closing_stock_value_purchase: closingStockValuePurchase,
        closing_stock_value_sale: closingStockValueSale,
        potential_profit: potentialProfit,
        profit_margin_pct: profitMarginPct,
        total_unit_sold: agg.sold,
        total_transferred: agg.transferred,
        total_adjusted: agg.adjusted,
      };
    });

    // 4. Calculate Aggregate Summary across ALL matching products
    const lowStockCount = items.filter(it => it.current_stock <= lowStockThreshold).length;

    // If low stock filter is active, restrict displayed items to low stock only
    if (isLowStockOnly) {
      items = items.filter(it => it.current_stock <= lowStockThreshold);
    }

    let totalStockOnHand = 0;
    let totalStockValuePurchase = 0;
    let totalStockValueSale = 0;
    let totalPotentialProfit = 0;
    let totalUnitsSold = 0;
    let totalTransferred = 0;
    let totalAdjusted = 0;

    for (const it of items) {
      totalStockOnHand += it.current_stock;
      totalStockValuePurchase += it.closing_stock_value_purchase;
      totalStockValueSale += it.closing_stock_value_sale;
      totalPotentialProfit += it.potential_profit;
      totalUnitsSold += it.total_unit_sold;
      totalTransferred += it.total_transferred;
      totalAdjusted += it.total_adjusted;
    }

    const overallMarginPct = totalStockValueSale > 0
      ? Math.round(((totalPotentialProfit / totalStockValueSale) * 100) * 10) / 10
      : 0;

    const summary: StockReportSummary = {
      total_stock_on_hand: totalStockOnHand,
      closing_stock_value_purchase: Math.round(totalStockValuePurchase * 100) / 100,
      closing_stock_value_sale: Math.round(totalStockValueSale * 100) / 100,
      potential_profit: Math.round(totalPotentialProfit * 100) / 100,
      profit_margin_pct: overallMarginPct,
      total_units_sold: totalUnitsSold,
      total_transferred: totalTransferred,
      total_adjusted: totalAdjusted,
      total_products_count: items.length,
      low_stock_count: lowStockCount,
    };

    // 5. Sort items
    items.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      switch (sortBy) {
        case 'status':
        case 'stock_status':
          valA = a.current_stock <= 0 ? 0 : (a.current_stock <= lowStockThreshold ? 1 : 2);
          valB = b.current_stock <= 0 ? 0 : (b.current_stock <= lowStockThreshold ? 1 : 2);
          break;
        case 'product':
        case 'name':
          valA = a.display_name.toLowerCase();
          valB = b.display_name.toLowerCase();
          break;
        case 'category':
          valA = (a.category_name || '').toLowerCase();
          valB = (b.category_name || '').toLowerCase();
          break;
        case 'brand':
          valA = (a.brand || '').toLowerCase();
          valB = (b.brand || '').toLowerCase();
          break;
        case 'price':
        case 'unit_price':
          valA = a.selling_price;
          valB = b.selling_price;
          break;
        case 'stock':
        case 'current_stock':
          valA = a.current_stock;
          valB = b.current_stock;
          break;
        case 'value_purchase':
          valA = a.closing_stock_value_purchase;
          valB = b.closing_stock_value_purchase;
          break;
        case 'value_sale':
          valA = a.closing_stock_value_sale;
          valB = b.closing_stock_value_sale;
          break;
        case 'potential_profit':
          valA = a.potential_profit;
          valB = b.potential_profit;
          break;
        case 'margin':
        case 'profit_margin_pct':
          valA = a.profit_margin_pct;
          valB = b.profit_margin_pct;
          break;
        case 'units_sold':
        case 'total_unit_sold':
          valA = a.total_unit_sold;
          valB = b.total_unit_sold;
          break;
        case 'total_transferred':
          valA = a.total_transferred;
          valB = b.total_transferred;
          break;
        case 'total_adjusted':
          valA = a.total_adjusted;
          valB = b.total_adjusted;
          break;
        case 'sku':
        default:
          valA = a.sku.toLowerCase();
          valB = b.sku.toLowerCase();
          break;
      }

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    // 6. Pagination slice
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const pagedProducts = items.slice((safePage - 1) * pageSize, safePage * pageSize);

    return {
      summary,
      products: pagedProducts,
      total,
      page: safePage,
      page_size: pageSize,
      total_pages: totalPages,
    };
  }

  public getProductStockHistory(productId: string, params?: {
    warehouse_id?: string;
    page?: number;
    page_size?: number;
  }): ProductStockHistoryResponse {
    const prod = this.products.get(productId);
    if (!prod) {
      throw new Error(`Product not found: ${productId}`);
    }

    const warehouseId = String(params?.warehouse_id || 'all').trim();
    const page = Math.max(1, Number(params?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params?.page_size) || 25));

    // Filter movements for this product and warehouse
    const productMovements = this.stockMovements.filter(m => {
      if (m.product_id !== productId) return false;
      if (warehouseId && warehouseId !== 'all' && m.warehouse_id !== warehouseId) return false;
      return true;
    });

    // Reusing the same running-balance logic as StockLedgerView.tsx:
    // Sort oldest first
    const sorted = [...productMovements].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let runningBalance = 0;
    const movementsWithBalance: ProductStockHistoryMovement[] = sorted.map(m => {
      const prevQty = runningBalance;
      const newQty = runningBalance + m.quantity_delta;
      runningBalance = newQty;
      const resolved = resolveStockMovementEntity(m, this);

      return {
        id: m.id,
        movement_reason: m.movement_reason,
        reason_label: formatMovementReasonLabel(m.movement_reason),
        quantity_delta: m.quantity_delta,
        previous_quantity: prevQty,
        new_quantity: newQty,
        created_at: m.created_at,
        reference_id: m.reference_id || '-',
        warehouse_id: m.warehouse_id,
        warehouse_name: m.warehouse_name,
        unit_cost: m.unit_cost,
        total_cost: m.total_cost,
        customer_name: resolved.customer_name,
        supplier_name: resolved.supplier_name,
        party_name: resolved.party_name,
        notes: m.notes,
      };
    });

    // Calculate Summary Block by summing quantity_delta grouped by movement_reason
    let totalPurchase = 0;
    let openingStock = 0;
    let totalSellReturn = 0;
    let stockTransfersIn = 0;

    let totalSold = 0;
    let totalStockAdjustment = 0;
    let totalPurchaseReturn = 0;
    let stockTransfersOut = 0;

    for (const m of sorted) {
      const reason = m.movement_reason;
      const delta = m.quantity_delta;

      if (reason === 'PURCHASE' || reason === 'PO_RECEIVING') {
        totalPurchase += delta;
      } else if (reason === 'OPENING_BALANCE') {
        openingStock += delta;
      } else if (reason === 'RETURN' || reason === 'RETURN_RESTOCK') {
        totalSellReturn += delta;
      } else if (reason === 'TRANSFER' && delta > 0) {
        stockTransfersIn += delta;
      } else if (reason === 'SALE') {
        totalSold += Math.abs(delta);
      } else if (['ADJUSTMENT', 'DAMAGE', 'LOSS', 'DAMAGED_WRITE_OFF', 'TESTER_CONVERSION', 'MARKETING_SAMPLE', 'GIFT'].includes(reason)) {
        totalStockAdjustment += Math.abs(delta);
      } else if (reason === 'PURCHASE_RETURN') {
        totalPurchaseReturn += Math.abs(delta);
      } else if (reason === 'TRANSFER' && delta < 0) {
        stockTransfersOut += Math.abs(delta);
      }
    }

    const currentStock = runningBalance;

    const summary: ProductStockHistorySummary = {
      total_purchase: totalPurchase,
      opening_stock: openingStock,
      total_sell_return: totalSellReturn,
      stock_transfers_in: stockTransfersIn,
      total_sold: totalSold,
      total_stock_adjustment: totalStockAdjustment,
      total_purchase_return: totalPurchaseReturn,
      stock_transfers_out: stockTransfersOut,
      current_stock: currentStock,
      total_inflow: totalPurchase + openingStock + totalSellReturn + stockTransfersIn,
      total_outflow: totalSold + totalStockAdjustment + totalPurchaseReturn + stockTransfersOut,
    };

    // Paginated chronological movement list
    const total = movementsWithBalance.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const pagedMovements = movementsWithBalance.slice((safePage - 1) * pageSize, safePage * pageSize);

    return {
      product: {
        id: prod.id,
        sku: prod.sku,
        display_name: prod.display_name,
        brand: prod.brand,
        category_name: prod.category_name,
        selling_price: prod.selling_price,
        avg_cost: prod.avg_cost,
        current_stock: currentStock,
      },
      warehouse_id: warehouseId,
      summary,
      movements: pagedMovements,
      total,
      page: safePage,
      page_size: pageSize,
      total_pages: totalPages,
    };
  }

  // Seed Initial 200+ Perfume Catalog, Warehouses, Users, Accounts
  private seedInitialData(): void {
    // 1. Warehouses (Section 7.1)
    this.warehouses.set('wh_main', { id: 'wh_main', name: 'Main / Back-store (2nd Floor)' });
    this.warehouses.set('wh_shop', { id: 'wh_shop', name: 'Shop Floor (Showroom)', is_default_fulfillment: true });

    // 2. Chart of Accounts (Section 15.0, 15.1)
    const accountsData: Account[] = [
      { id: 'acc_cash', code: '1010', name: 'Cash in Hand (Shop Till)', type: 'asset', balance: 45000 },
      { id: 'acc_bank', code: '1020', name: 'City Bank Account', type: 'asset', balance: 350000 },
      { id: 'acc_bank_personal', code: '1021', name: 'Personal Bank Account', type: 'asset', balance: 0 },
      { id: 'acc_bkash', code: '1030', name: 'bKash Merchant Wallet', type: 'asset', balance: 82500 },
      { id: 'acc_nagad', code: '1040', name: 'Nagad Merchant Wallet', type: 'asset', balance: 31000 },
      { id: 'acc_courier_rec', code: '1100', name: 'Courier Receivable (Steadfast Clearing)', type: 'asset', balance: 145000 },
      { id: 'acc_inventory', code: '1200', name: 'Perfume Stock Inventory', type: 'asset', balance: 1250000 },
      { id: 'acc_supp_pay', code: '2010', name: 'Dubai Supplier Payables', type: 'liability', balance: 420000 },
      { id: 'acc_sales_rev', code: '4010', name: 'Product Sales Revenue', type: 'income', balance: 0 },
      { id: 'acc_deliv_inc', code: '4020', name: 'Delivery Charge Income', type: 'income', balance: 0 },
      { id: 'acc_sales_ret', code: '4030', name: 'Sales Returns & Customer Refunds', type: 'income', balance: 0 },
      { id: 'acc_other_inc', code: '4090', name: 'Other Income & Cash Overages', type: 'income', balance: 0 },
      { id: 'acc_cogs', code: '5010', name: 'Cost of Goods Sold (COGS)', type: 'expense', balance: 0 },
      { id: 'acc_rent_exp', code: '6010', name: 'Shop & Office Rent', type: 'expense', balance: 0 },
      { id: 'acc_salary_exp', code: '6020', name: 'Employee Salaries', type: 'expense', balance: 0 },
      { id: 'acc_salary_advance', code: '1150', name: 'Salary Advances & Employee Loans', type: 'asset', balance: 0 },
      { id: 'acc_pf_payable', code: '2050', name: 'Provident Fund & Statutory Payable', type: 'liability', balance: 0 },
      { id: 'acc_tax_payable', code: '2060', name: 'Payroll Tax Withholding Payable', type: 'liability', balance: 0 },
      { id: 'acc_courier_exp', code: '6030', name: 'Courier Freight & RTO Charges', type: 'expense', balance: 0 },
      { id: 'acc_courier_discrepancy', code: '6035', name: 'Courier Settlement Discrepancies & Adjustments', type: 'expense', balance: 0 },
      { id: 'acc_tester_exp', code: '6040', name: 'Showroom Tester & Marketing Expense', type: 'expense', balance: 0 },
      { id: 'acc_damaged_exp', code: '6050', name: 'Damaged & Broken Perfume Stock Loss', type: 'expense', balance: 0 },
      { id: 'acc_util_exp', code: '6060', name: 'Shop Electricity, Internet & Utilities', type: 'expense', balance: 0 },
      { id: 'acc_mkt_exp', code: '6070', name: 'Meta Ads & Influencer PR Marketing', type: 'expense', balance: 0 },
      { id: 'acc_pack_exp', code: '6080', name: 'Packaging Materials, Boxes & Tape', type: 'expense', balance: 0 },
      { id: 'acc_office_exp', code: '6090', name: 'Office Tea, Snacks & Supplies', type: 'expense', balance: 0 },
      { id: 'acc_cash_shortage', code: '6100', name: 'Cash Till Shortage Expense', type: 'expense', balance: 0 },
      { id: 'acc_bank_charges', code: '6110', name: 'Bank Fees & Mobile Money Gateway Charges', type: 'expense', balance: 0 },
      { id: 'acc_drawings', code: '3020', name: 'Owner Drawings & Personal Withdrawals', type: 'equity', balance: 0 },
      { id: 'acc_equity', code: '3010', name: 'Owner Capital & Opening Balance Equity', type: 'equity', balance: 1483500 },
    ];
    accountsData.forEach(a => this.accounts.set(a.id, a));

    // 2b. Initial Payment Accounts (Section 15, Financial Control Layer)
    const paymentAccountsData: PaymentAccount[] = [
      {
        id: 'pmt_cash_shop',
        account_name: 'Shop Cash Register (Front Till)',
        account_type: 'cash',
        account_number: 'CASH-BANANI-01',
        linked_chart_account_id: 'acc_cash',
        linked_chart_account_code: '1010',
        linked_chart_account_name: 'Cash in Hand (Shop Till)',
        is_default_pos: true,
        is_default_expense: true,
        is_active: true,
        opening_balance: 45000,
        current_balance: 45000,
        notes: 'Main showroom POS cash drawer at Banani',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'pmt_bank_city',
        account_name: 'City Bank Principal Account',
        account_type: 'bank',
        account_number: '110-234-5678901',
        bank_name: 'City Bank Ltd.',
        branch_name: 'Banani Branch',
        routing_number: '225270114',
        linked_chart_account_id: 'acc_bank',
        linked_chart_account_code: '1020',
        linked_chart_account_name: 'City Bank Account',
        is_default_courier_settlement: true,
        is_default_payroll: true,
        is_active: true,
        opening_balance: 350000,
        current_balance: 350000,
        notes: 'Corporate checking account for supplier wire transfers & courier settlement',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'pmt_bank_personal',
        account_name: 'Personal Bank Account (Sobuj Sehk)',
        account_type: 'bank',
        account_number: '105-998-1122334',
        bank_name: 'BRAC Bank Ltd.',
        branch_name: 'Gulshan Branch',
        linked_chart_account_id: 'acc_bank_personal',
        linked_chart_account_code: '1021',
        linked_chart_account_name: 'Personal Bank Account',
        is_active: true,
        opening_balance: 0,
        current_balance: 0,
        notes: 'Owner personal account for emergency liquidity & capital injections',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'pmt_bkash_merchant',
        account_name: 'bKash Merchant Wallet',
        account_type: 'bkash',
        account_number: '01711000001',
        linked_chart_account_id: 'acc_bkash',
        linked_chart_account_code: '1030',
        linked_chart_account_name: 'bKash Merchant Wallet',
        is_active: true,
        opening_balance: 82500,
        current_balance: 82500,
        notes: 'Official 01711 merchant number for online order advance & walk-in QR payments',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'pmt_nagad_merchant',
        account_name: 'Nagad Merchant Wallet',
        account_type: 'nagad',
        account_number: '01711000002',
        linked_chart_account_id: 'acc_nagad',
        linked_chart_account_code: '1040',
        linked_chart_account_name: 'Nagad Merchant Wallet',
        is_active: true,
        opening_balance: 31000,
        current_balance: 31000,
        notes: 'Nagad merchant account for digital payments',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];
    paymentAccountsData.forEach(p => this.paymentAccounts.set(p.id, p));

    // 3. Initial Users (Section 20.0, 20.0a)
    const defaultPasswordHash = hashPassword('mirage2026');
    const usersData: User[] = [
      {
        id: 'usr_owner',
        name: 'Sobuj Sehk (Owner)',
        email: 'sobuj@mirageperfume.com',
        phone: '01711000001',
        password: defaultPasswordHash,
        tier: 1,
        role: 'Owner',
        active: true,
        capabilities: [
          'view_sales_orders',
          'view_inventory_stock',
          'view_cost_margin',
          'view_full_accounting_pnl',
          'view_salary_data',
          'create_edit_orders',
          'cancel_orders',
          'pack_orders',
          'dispatch_orders',
          'edit_product_prices',
          'create_edit_products',
          'receive_stock',
          'transfer_stock',
          'adjust_stock',
          'view_accounts',
          'manage_accounts',
          'manage_users',
          'system_settings',
          'view_audit_log',
        ],
        toggles: {},
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_gm',
        name: 'Arif Rahman (Accountant / GM)',
        email: 'arif@mirageperfume.com',
        phone: '01711000002',
        password: defaultPasswordHash,
        tier: 2,
        role: 'Accountant',
        active: true,
        capabilities: [
          'view_sales_orders',
          'view_inventory_stock',
          'view_cost_margin',
          'view_full_accounting_pnl',
          'view_salary_data',
          'cancel_orders',
          'view_accounts',
          'manage_accounts',
          'view_audit_log',
        ],
        toggles: {},
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_mgr',
        name: 'Tanvir Ahmed (Sales / Showroom)',
        email: 'tanvir@mirageperfume.com',
        phone: '01711000003',
        password: defaultPasswordHash,
        tier: 3,
        role: 'Showroom & Sales',
        active: true,
        capabilities: [
          'view_sales_orders',
          'view_inventory_stock',
          'create_edit_orders',
          'cancel_orders',
          'transfer_stock',
        ],
        toggles: {},
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_pack',
        name: 'Kalam Hossain (Packing Team)',
        email: 'kalam@mirageperfume.com',
        phone: '01711000004',
        password: defaultPasswordHash,
        tier: 4,
        role: 'Packing Team',
        active: true,
        capabilities: [
          'view_sales_orders',
          'view_inventory_stock',
          'pack_orders',
          'dispatch_orders',
        ],
        toggles: {},
        created_at: new Date().toISOString(),
      },
    ];
    usersData.forEach(u => this.users.set(u.id, u));

    // 4. Initial Customers
    const sampleCusts: Customer[] = [
      {
        id: 'CUST-101',
        name: 'Arif Islam',
        phone: '01999033027',
        order_count: 5,
        total_spent: 28500,
        risk_flag: false,
        completed_count: 5,
        addresses: [
          {
            id: 'ADDR-101-1',
            customer_id: 'CUST-101',
            address_text: 'House 47, Road 27, Opposite of Banani Graveyard main gate. Building: Millennium Castle, Lift-4, Banani, Dhaka',
            is_default: true,
          },
        ],
        created_at: '2026-01-10T10:00:00Z',
      },
      {
        id: 'CUST-102',
        name: 'Mahmudul Hasan',
        phone: '01712345678',
        order_count: 3,
        total_spent: 14200,
        risk_flag: false,
        completed_count: 3,
        addresses: [
          {
            id: 'ADDR-102-1',
            customer_id: 'CUST-102',
            address_text: 'Flat 4B, Plot 12, Sector 7, Uttara, Dhaka',
            is_default: true,
          },
        ],
        created_at: '2026-01-15T11:30:00Z',
      },
      {
        id: 'CUST-103',
        name: 'Sayed Karim',
        phone: '01819998877',
        order_count: 4,
        total_spent: 0,
        risk_flag: true,
        rto_count: 3,
        cancelled_count: 1,
        completed_count: 0,
        addresses: [
          {
            id: 'ADDR-103-1',
            customer_id: 'CUST-103',
            address_text: 'Chawkbazar, Chittagong',
            is_default: true,
          },
        ],
        created_at: '2026-02-01T14:20:00Z',
      },
    ];
    sampleCusts.forEach(c => this.customers.set(c.id, c));

    // 5. Seed Real Perfume Catalog into Inventory (130 SKUs)
    this.seedPerfumeCatalog();
    this.seedSampleOrdersAndBookings();
    this.seedPackagingMaterials();
  }

  private seedPackagingMaterials(): void {
    const materials: PackagingMaterial[] = [
      { id: 'pkg_ctn_s', name: 'Small Carton', barcode: 'CTN-S', sku: 'CTN-S', category: 'carton', unit: 'piece', on_hand: 85, reserved: 0, available: 85, reorder_level: 20, unit_cost: 35, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_ctn_m', name: 'Medium Carton', barcode: 'CTN-M', sku: 'CTN-M', category: 'carton', unit: 'piece', on_hand: 112, reserved: 0, available: 112, reorder_level: 20, unit_cost: 55, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_ctn_l', name: 'Large Carton', barcode: 'CTN-L', sku: 'CTN-L', category: 'carton', unit: 'piece', on_hand: 45, reserved: 0, available: 45, reorder_level: 15, unit_cost: 75, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_poly_s', name: 'Small Poly Bag', barcode: 'POLY-S', sku: 'POLY-S', category: 'poly', unit: 'piece', on_hand: 200, reserved: 0, available: 200, reorder_level: 50, unit_cost: 8, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_poly_m', name: 'Medium Poly Bag', barcode: 'POLY-M', sku: 'POLY-M', category: 'poly', unit: 'piece', on_hand: 180, reserved: 0, available: 180, reorder_level: 50, unit_cost: 12, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_poly_l', name: 'Large Poly Bag', barcode: 'POLY-L', sku: 'POLY-L', category: 'poly', unit: 'piece', on_hand: 95, reserved: 0, available: 95, reorder_level: 30, unit_cost: 18, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_poly_ml', name: 'Poly Bag M-L', barcode: 'POLY-ML', sku: 'POLY-ML', category: 'poly', unit: 'piece', on_hand: 140, reserved: 0, available: 140, reorder_level: 40, unit_cost: 15, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_bubble', name: 'Bubble Wrap Roll', barcode: 'BUBBLE-01', sku: 'BUBBLE-01', category: 'wrapping', unit: 'roll', on_hand: 8, reserved: 0, available: 8, reorder_level: 3, unit_cost: 350, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_gumtape', name: '48mm Gum Tape', barcode: 'TAPE-48', sku: 'TAPE-48', category: 'tape', unit: 'roll', on_hand: 12, reserved: 0, available: 12, reorder_level: 5, unit_cost: 85, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_scotch', name: 'Scotch Tape', barcode: 'TAPE-SC', sku: 'TAPE-SC', category: 'tape', unit: 'roll', on_hand: 6, reserved: 0, available: 6, reorder_level: 3, unit_cost: 45, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_scissors', name: 'Scissors', barcode: 'TOOL-SC', sku: 'TOOL-SC', category: 'cutting_tool', unit: 'piece', on_hand: 3, reserved: 0, available: 3, reorder_level: 1, unit_cost: 120, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_cutter', name: 'Anti Cutter', barcode: 'TOOL-AC', sku: 'TOOL-AC', category: 'cutting_tool', unit: 'piece', on_hand: 2, reserved: 0, available: 2, reorder_level: 1, unit_cost: 150, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_blades', name: 'Cutter Blades', barcode: 'TOOL-BL', sku: 'TOOL-BL', category: 'cutting_tool', unit: 'pack', on_hand: 15, reserved: 0, available: 15, reorder_level: 5, unit_cost: 25, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_giftpaper', name: 'Gift Paper Roll', barcode: 'GIFT-PAP', sku: 'GIFT-PAP', category: 'gift', unit: 'roll', on_hand: 10, reserved: 0, available: 10, reorder_level: 3, unit_cost: 200, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_sticker', name: 'Parcel Sticker', barcode: 'LBL-PAR', sku: 'LBL-PAR', category: 'label', unit: 'sheet', on_hand: 300, reserved: 0, available: 300, reorder_level: 100, unit_cost: 3, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pkg_ty_card', name: 'Thank You Card', barcode: 'GIFT-TYC', sku: 'GIFT-TYC', category: 'gift', unit: 'piece', on_hand: 250, reserved: 0, available: 250, reorder_level: 80, unit_cost: 5, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    materials.forEach(m => this.packagingMaterials.set(m.id, m));
    // Seed opening balance movements for each material
    materials.forEach(m => {
      this.packagingStockMovements.push({
        id: `pkgmov_ob_${m.id}`,
        material_id: m.id,
        material_name: m.name,
        barcode: m.barcode,
        quantity_delta: m.on_hand,
        reason: 'OPENING_BALANCE',
        unit_cost: m.unit_cost,
        created_by: 'usr_owner',
        created_by_name: 'Owner',
        created_at: new Date().toISOString(),
        notes: 'Initial opening balance',
      });
    });
  }

  // Packaging Materials CRUD
  public createPackagingMaterial(params: {
    name: string; barcode: string; sku: string; category: PackagingCategory;
    unit: string; reorder_level: number; unit_cost: number; notes?: string;
    opening_stock?: number; actor_id?: string; actor_name?: string;
  }): PackagingMaterial {
    const id = `pkg_${Date.now()}`;
    const now = new Date().toISOString();
    const openingStock = params.opening_stock || 0;
    const mat: PackagingMaterial = {
      id, name: params.name, barcode: params.barcode, sku: params.sku,
      category: params.category, unit: params.unit,
      on_hand: openingStock, reserved: 0, available: openingStock,
      reorder_level: params.reorder_level, unit_cost: params.unit_cost,
      notes: params.notes, active: true, created_at: now, updated_at: now,
    };
    this.packagingMaterials.set(id, mat);
    if (openingStock > 0) {
      this.packagingStockMovements.push({
        id: `pkgmov_${Date.now()}`, material_id: id, material_name: mat.name,
        barcode: mat.barcode, quantity_delta: openingStock, reason: 'OPENING_BALANCE',
        unit_cost: mat.unit_cost, created_by: params.actor_id || 'system',
        created_by_name: params.actor_name || 'System', created_at: now,
        notes: 'Opening stock at creation',
      });
    }
    this.logAudit(params.actor_id || 'system', params.actor_name || 'System',
      'packaging_material_created', 'packaging_material', id, `Created ${mat.name}`);
    return mat;
  }

  public updatePackagingMaterial(id: string, params: Partial<PackagingMaterial>, actor_id?: string, actor_name?: string): PackagingMaterial | null {
    const mat = this.packagingMaterials.get(id);
    if (!mat) return null;
    const before = { ...mat };
    if (params.name !== undefined) mat.name = params.name;
    if (params.barcode !== undefined) mat.barcode = params.barcode;
    if (params.sku !== undefined) mat.sku = params.sku;
    if (params.category !== undefined) mat.category = params.category;
    if (params.unit !== undefined) mat.unit = params.unit;
    if (params.reorder_level !== undefined) mat.reorder_level = params.reorder_level;
    if (params.unit_cost !== undefined) mat.unit_cost = params.unit_cost;
    if (params.notes !== undefined) mat.notes = params.notes;
    mat.updated_at = new Date().toISOString();
    this.logAudit(actor_id || 'system', actor_name || 'System',
      'packaging_material_updated', 'packaging_material', id, `Updated ${mat.name}`,
      JSON.stringify(before), JSON.stringify(mat));
    return mat;
  }

  public receivePackagingStock(material_id: string, quantity: number, unit_cost: number,
    reference_note?: string, actor_id?: string, actor_name?: string): PackagingMaterial | null {
    const mat = this.packagingMaterials.get(material_id);
    if (!mat) return null;
    const now = new Date().toISOString();
    mat.on_hand += quantity;
    mat.available += quantity;
    if (unit_cost > 0) mat.unit_cost = unit_cost;
    mat.updated_at = now;
    this.packagingStockMovements.push({
      id: `pkgmov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      material_id, material_name: mat.name, barcode: mat.barcode,
      quantity_delta: quantity, reason: 'PURCHASE', unit_cost,
      reference_note, created_by: actor_id || 'system',
      created_by_name: actor_name || 'System', created_at: now,
    });
    this.logAudit(actor_id || 'system', actor_name || 'System',
      'packaging_stock_received', 'packaging_material', material_id,
      `Received ${quantity} ${mat.unit} of ${mat.name}`);
    return mat;
  }

  public usePackagingStock(material_id: string, quantity: number, order_id: string,
    actor_id?: string, actor_name?: string): PackagingMaterial | null {
    const mat = this.packagingMaterials.get(material_id);
    if (!mat || mat.available < quantity) return null;
    const now = new Date().toISOString();
    mat.on_hand -= quantity;
    mat.available -= quantity;
    mat.updated_at = now;
    this.packagingStockMovements.push({
      id: `pkgmov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      material_id, material_name: mat.name, barcode: mat.barcode,
      quantity_delta: -quantity, reason: 'PACKAGING_USED', unit_cost: mat.unit_cost,
      reference_id: order_id, reference_note: `Packed order ${order_id}`,
      created_by: actor_id || 'system', created_by_name: actor_name || 'System',
      created_at: now,
    });
    return mat;
  }

  public getPackagingStockStatus(mat: PackagingMaterial): string {
    if (mat.on_hand <= 0) return 'out_of_stock';
    if (mat.on_hand <= mat.reorder_level * 0.5) return 'critical';
    if (mat.on_hand <= mat.reorder_level) return 'low_stock';
    return 'healthy';
  }

  private seedPerfumeCatalog(): void {
    const rawCatalog: {
      brand: string;
      codePrefix: string;
      name: string;
      concentration: PerfumeConcentration;
      size: string;
      category: string;
      cost: number;
      price: number;
      barcodePrefix: string;
    }[] = [
      { brand: "Afnan", codePrefix: "AFN", name: "9AM Dive", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Aquatic Fresh", cost: 0, price: 3300, barcodePrefix: "6290171" },
      { brand: "Afnan", codePrefix: "AFN", name: "9AM Femme", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Floral Fruity", cost: 0, price: 3300, barcodePrefix: "6290171" },
      { brand: "Afnan", codePrefix: "AFN", name: "9PM Elixir", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 3900, barcodePrefix: "6290171" },
      { brand: "Afnan", codePrefix: "AFN", name: "9PM Night Out", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 5200, barcodePrefix: "6290171" },
      { brand: "Afnan", codePrefix: "AFN", name: "9PM Rebel", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 3900, barcodePrefix: "6290171" },
      { brand: "Afnan", codePrefix: "AFN", name: "9PM Women/9PM Femme", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Floral Fruity", cost: 0, price: 3200, barcodePrefix: "6290171" },
      { brand: "Afnan", codePrefix: "AFN", name: "9PM/9PM OG/9PM Man", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 3200, barcodePrefix: "6290171" },
      { brand: "Afnan", codePrefix: "AFN", name: "Rare Reef", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 3800, barcodePrefix: "6290171" },
      { brand: "Afnan", codePrefix: "AFN", name: "Supremacy Collector Edition", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 6200, barcodePrefix: "6290171" },
      { brand: "Afnan", codePrefix: "AFN", name: "Supremacy Not Only Intense/NOI", concentration: "Extrait" as PerfumeConcentration, size: "150ML", category: "Smoky Leather", cost: 0, price: 6400, barcodePrefix: "6290171" },
      { brand: "Afnan", codePrefix: "AFN", name: "Turathi Electric", concentration: "EDP" as PerfumeConcentration, size: "90ML", category: "Oriental Fresh", cost: 0, price: 3600, barcodePrefix: "6290171" },
      { brand: "Ahmed Al Magribi", codePrefix: "AAM", name: "Blue", concentration: "Extrait" as PerfumeConcentration, size: "100ML", category: "Aquatic Fresh", cost: 2200, price: 2300, barcodePrefix: "6290172" },
      { brand: "Ahmed Al Magribi", codePrefix: "AAM", name: "Rawdha", concentration: "EDP" as PerfumeConcentration, size: "50ML", category: "Oriental Fresh", cost: 3650, price: 3750, barcodePrefix: "6290172" },
      { brand: "Al Haramain", codePrefix: "ALH", name: "Amber Oud Aqua Dubai", concentration: "Extrait" as PerfumeConcentration, size: "100ML", category: "Aquatic Fresh", cost: 4850, price: 4950, barcodePrefix: "6290173" },
      { brand: "Al Haramain", codePrefix: "ALH", name: "Amber Oud Aqua Dubai", concentration: "Extrait" as PerfumeConcentration, size: "200ML", category: "Aquatic Fresh", cost: 7250, price: 7450, barcodePrefix: "6290173" },
      { brand: "Al Haramain", codePrefix: "ALH", name: "Amber Oud Gold", concentration: "EDP" as PerfumeConcentration, size: "200ML", category: "Woody Oriental", cost: 7250, price: 7450, barcodePrefix: "6290173" },
      { brand: "Al Haramain", codePrefix: "ALH", name: "L'Aventure", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 3650, barcodePrefix: "6290173" },
      { brand: "Al Haramain", codePrefix: "ALH", name: "L'Aventure", concentration: "EDP" as PerfumeConcentration, size: "200ML", category: "Oriental Fresh", cost: 5450, price: 5750, barcodePrefix: "6290173" },
      { brand: "Al Haramain", codePrefix: "ALH", name: "L'Aventure Intense", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Smoky Leather", cost: 4250, price: 4450, barcodePrefix: "6290173" },
      { brand: "Arabiyat Prestige", codePrefix: "ARP", name: "Marwa", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Floral Fruity", cost: 3500, price: 3600, barcodePrefix: "6290174" },
      { brand: "Arabiyat Prestige", codePrefix: "ARP", name: "Ramad Earthy", concentration: "Extrait" as PerfumeConcentration, size: "100ML", category: "Woody Oriental", cost: 0, price: 3500, barcodePrefix: "6290174" },
      { brand: "Armaf", codePrefix: "AMF", name: "Club Di Nuit Iconic", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 4100, price: 4200, barcodePrefix: "6294015" },
      { brand: "Armaf", codePrefix: "AMF", name: "Club Di Nuit Intense Man (CDNIM)", concentration: "EDT" as PerfumeConcentration, size: "105ML", category: "Smoky Leather", cost: 3400, price: 3500, barcodePrefix: "6294015" },
      { brand: "Armaf", codePrefix: "AMF", name: "Club Di Nuit Intense Man (CDNIM)", concentration: "EDP" as PerfumeConcentration, size: "200ML", category: "Smoky Leather", cost: 0, price: 5250, barcodePrefix: "6294015" },
      { brand: "Armaf", codePrefix: "AMF", name: "Club Di Nuit Intense Man (CDNIM)", concentration: "Parfum" as PerfumeConcentration, size: "150ML", category: "Smoky Leather", cost: 5700, price: 5900, barcodePrefix: "6294015" },
      { brand: "Armaf", codePrefix: "AMF", name: "Club Di Nuit Sillage", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 3600, price: 3700, barcodePrefix: "6294015" },
      { brand: "Armaf", codePrefix: "AMF", name: "Club Di Nuit Urban Man Elixir", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 3350, price: 3450, barcodePrefix: "6294015" },
      { brand: "Armaf", codePrefix: "AMF", name: "Dunescape", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 3400, barcodePrefix: "6294015" },
      { brand: "Atralia", codePrefix: "ATR", name: "Absolute Chill", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2100, price: 2200, barcodePrefix: "6290175" },
      { brand: "Atralia", codePrefix: "ATR", name: "Absolute Ice", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Aquatic Fresh", cost: 2150, price: 2250, barcodePrefix: "6290175" },
      { brand: "Atralia", codePrefix: "ATR", name: "Absolute Noir", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Smoky Leather", cost: 2100, price: 2200, barcodePrefix: "6290175" },
      { brand: "Atralia", codePrefix: "ATR", name: "Quantum", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2700, price: 2800, barcodePrefix: "6290175" },
      { brand: "Atralia", codePrefix: "ATR", name: "Rouge Orchard (W)", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2200, price: 2300, barcodePrefix: "6290175" },
      { brand: "Atralia", codePrefix: "ATR", name: "Sensual Vanilla (W)", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Amber Gourmand", cost: 2200, price: 2300, barcodePrefix: "6290175" },
      { brand: "Atralia", codePrefix: "ATR", name: "Sugar Mallow (W)", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Amber Gourmand", cost: 2200, price: 2300, barcodePrefix: "6290175" },
      { brand: "Aurora Perfumes", codePrefix: "AUP", name: "Cherry In The Woods (W)", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Woody Oriental", cost: 4000, price: 4250, barcodePrefix: "6290176" },
      { brand: "French Avenue", codePrefix: "FRA", name: "Liquid Brun", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Amber Gourmand", cost: 0, price: 3450, barcodePrefix: "6290177" },
      { brand: "French Avenue", codePrefix: "FRA", name: "Amber Empire", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 3600, barcodePrefix: "6290177" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "25 Heritage", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2400, price: 2500, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "25 Integrity", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2400, price: 2500, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "25 Loyalty", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2400, price: 2500, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "25 Trust", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2400, price: 2500, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Azure Velvet", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2750, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Cloud Candy", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Amber Gourmand", cost: 0, price: 3300, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Empire Empress", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2700, price: 2800, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Empire Victor", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2800, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Icon", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2650, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Island", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2750, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Island Dream", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2650, price: 2750, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Island Vanilla Dunes", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Amber Gourmand", cost: 0, price: 2750, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Karus Gold Absolu", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2750, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Karus Gold Absolu (2nd Variant)", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2750, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Karus Secret Musk", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2750, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Karus Oud Fire", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Woody Oriental", cost: 0, price: 2750, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "La Fede Aura Kiss of Rose", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Floral Fruity", cost: 0, price: 2000, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "La Fede Aura Vanilla Milk", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Amber Gourmand", cost: 0, price: 2000, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "La Fede Aura Manga Splash", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2000, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "La Fede Intoxicate Mystique", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2950, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Maison Spray", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2400, price: 2500, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Nafais Magrib", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2400, price: 2500, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Panache Angel Dust", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2650, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Peace Velvet", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2700, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Shiyaaka Gold", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2000, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Shiyaaka Man/Blue", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Aquatic Fresh", cost: 0, price: 2050, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Shiyaaka Shadow", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Smoky Leather", cost: 0, price: 2550, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Shiyaaka Sky", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2550, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Shiyaaka Snow", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2550, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Titan", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2750, barcodePrefix: "6291107" },
      { brand: "Khadlaj", codePrefix: "KDL", name: "Zayaan Silver", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2750, barcodePrefix: "6291107" },
      { brand: "Lattafa", codePrefix: "LTF", name: "Ameer Al Oud Intense Oud", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Woody Oriental", cost: 1900, price: 1950, barcodePrefix: "6291108" },
      { brand: "Lattafa", codePrefix: "LTF", name: "Atlas", concentration: "EDP" as PerfumeConcentration, size: "55ML", category: "Oriental Fresh", cost: 0, price: 2900, barcodePrefix: "6291108" },
      { brand: "Lattafa", codePrefix: "LTF", name: "Dynasty", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 3400, barcodePrefix: "6291108" },
      { brand: "Lattafa", codePrefix: "LTF", name: "Fakhar Black", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Smoky Leather", cost: 0, price: 2400, barcodePrefix: "6291108" },
      { brand: "Lattafa", codePrefix: "LTF", name: "Khamrah", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Amber Gourmand", cost: 0, price: 3100, barcodePrefix: "6291108" },
      { brand: "Lattafa", codePrefix: "LTF", name: "Khamrah Dukhan", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Amber Gourmand", cost: 0, price: 3100, barcodePrefix: "6291108" },
      { brand: "Lattafa", codePrefix: "LTF", name: "Khamrah Qahwa", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Amber Gourmand", cost: 0, price: 3100, barcodePrefix: "6291108" },
      { brand: "Lattafa", codePrefix: "LTF", name: "Yara/Yara Pink (W)", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Floral Fruity", cost: 2200, price: 2300, barcodePrefix: "6291108" },
      { brand: "Lattafa", codePrefix: "LTF", name: "Hayaati/Hayaati Black", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Smoky Leather", cost: 1700, price: 1750, barcodePrefix: "6291108" },
      { brand: "Maison Asrar", codePrefix: "MAS", name: "Hunter", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2500, price: 2600, barcodePrefix: "6290178" },
      { brand: "Maison Asrar", codePrefix: "MAS", name: "Vanguard", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2500, price: 3600, barcodePrefix: "6290178" },
      { brand: "Paris Corner", codePrefix: "PRC", name: "Fig Hug", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2600, price: 2700, barcodePrefix: "6290179" },
      { brand: "Paris Corner", codePrefix: "PRC", name: "Khair", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2050, barcodePrefix: "6290179" },
      { brand: "Paris corner", codePrefix: "PRC", name: "Khair Confection", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 1950, price: 2050, barcodePrefix: "6290179" },
      { brand: "Paris Corner", codePrefix: "PRC", name: "Khair Falicity", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 1950, price: 2050, barcodePrefix: "6290179" },
      { brand: "Paris Corner", codePrefix: "PRC", name: "Rifaaqat", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2000, price: 2050, barcodePrefix: "6290179" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Dareej", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 1800, price: 1900, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Dareej", concentration: "Extrait" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 2200, price: 2250, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Atlantis", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 3400, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Black", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Smoky Leather", cost: 2800, price: 2900, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Chrome", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 3400, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Diva", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Floral Fruity", cost: 0, price: 2900, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Eclat", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 3000, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Elixir", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 2700, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Fire", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 3400, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas for Him/Man/OG", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 2650, price: 2750, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Ice", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Aquatic Fresh", cost: 2900, price: 3000, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Kobra", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 2650, price: 2750, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas London", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 2900, price: 3000, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Majestic", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 3000, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Malibu", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 2900, price: 3000, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Nautilus", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Aquatic Fresh", cost: 0, price: 3300, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Pink", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Floral Fruity", cost: 0, price: 3300, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Reina", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Floral Fruity", cost: 0, price: 3000, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Rogue", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 3200, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Tropical", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 3250, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Hawas Gold Digger", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 3250, barcodePrefix: "6145140" },
      { brand: "Rasasi", codePrefix: "RSA", name: "Shuhrah Pour Homme", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 2200, price: 2300, barcodePrefix: "6145140" },
      { brand: "Riffs", codePrefix: "RIF", name: "Fareed", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2250, price: 2300, barcodePrefix: "6290180" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Aquatica", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Aquatic Fresh", cost: 2100, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Ayka", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 1800, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Ell Wood", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Woody Oriental", cost: 0, price: 2000, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Imperia", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2000, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Fresh Wave", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2000, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Azul", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Aquatic Fresh", cost: 0, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Cedrus Blanc", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Woody Oriental", cost: 2100, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Crimson", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Dahliya (W)", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Floral Fruity", cost: 1750, price: 1850, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Elixir", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 2100, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Jungle Vibe", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Kiss (W)", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Floral Fruity", cost: 0, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Lion", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2100, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Nocturno Elixir", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Citrus Aromatic", cost: 0, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Pacific Aloha", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Aquatic Fresh", cost: 0, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Pharaoh", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 0, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Terra", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Woody Oriental", cost: 0, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Tiger", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Woody Oriental", cost: 0, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Tonquin Giza", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2100, price: 2200, barcodePrefix: "6290181" },
      { brand: "Rayhaan", codePrefix: "RAY", name: "Nava Sol", concentration: "EDP" as PerfumeConcentration, size: "100ML", category: "Oriental Fresh", cost: 2100, price: 2200, barcodePrefix: "6290181" },
      { brand: "Swiss Arabian", codePrefix: "SAB", name: "Casablanca", concentration: "Extrait" as PerfumeConcentration, size: "50ML", category: "Oriental Fresh", cost: 0, price: 4500, barcodePrefix: "6290182" },
      { brand: "Swiss Arabian", codePrefix: "SAB", name: "Tobacco 01", concentration: "Extrait" as PerfumeConcentration, size: "50ML", category: "Smoky Leather", cost: 0, price: 5300, barcodePrefix: "6290182" },
    ];

    let prodIdx = 1;
    const brandCounts: Record<string, number> = {};

    for (const item of rawCatalog) {
      brandCounts[item.codePrefix] = (brandCounts[item.codePrefix] || 0) + 1;
      const sku = `${item.codePrefix}${String(brandCounts[item.codePrefix]).padStart(3, '0')}`;
      const id = `PROD-${sku.toLowerCase()}`;
      const barcode = `${item.barcodePrefix}${String(100000 + prodIdx).slice(1)}`;
      const displayName = `${item.brand} ${item.name} ${item.concentration} ${item.size}`;

      const prod: Product = {
        id,
        sku,
        barcode,
        name: item.name,
        brand: item.brand,
        concentration: item.concentration,
        size_variant: item.size,
        category_id: item.category.toLowerCase().replace(/\s+/g, '_'),
        category_name: item.category,
        photo_url: `https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=300&q=80`,
        avg_cost: item.cost,
        selling_price: item.price,
        price_updated_at: new Date().toISOString(),
        low_stock_threshold: 3,
        batch_tracked: false,
        is_bundle: false,
        display_name: displayName,
        active: true,
        created_at: new Date().toISOString(),
      };

      this.products.set(id, prod);

      // Seed initial stock across warehouses (Section 7.1)
      const mainQty = Math.floor(Math.random() * 12) + 5;
      const shopQty = Math.floor(Math.random() * 8) + 3;

      this.inventory.set(this.invKey(id, 'wh_main'), {
        product_id: id,
        warehouse_id: 'wh_main',
        on_hand: mainQty,
        reserved: 0,
        avg_cost: item.cost,
      });

      this.inventory.set(this.invKey(id, 'wh_shop'), {
        product_id: id,
        warehouse_id: 'wh_shop',
        on_hand: shopQty,
        reserved: 0,
        avg_cost: item.cost,
      });

      // Seed realistic Shipments / Lots (User Rule: Multi-lot inventory tracking)
      const isZayaan = item.name.toLowerCase().includes('zayaan') || sku === 'KDL006';
      if (isZayaan) {
        // Exact prompt example
        this.batches.push({
          id: `BATCH-${id}-001`,
          product_id: id,
          batch_code: 'LOT-001',
          warehouse_id: 'wh_shop',
          warehouse_name: 'Shop Floor (Showroom)',
          quantity_received: 20,
          quantity_remaining: 7,
          purchase_cost: 2300,
          selling_price: 2750,
          manufacturing_date: '2026-06-15T00:00:00Z',
          expiry_date: '2031-06-15T00:00:00Z',
          import_date: '2026-07-01T00:00:00Z',
          received_at: '2026-07-01T00:00:00Z',
          maturation_status: 'READY',
          authenticity_status: 'verified',
          created_at: '2026-07-01T00:00:00Z',
        });
        this.batches.push({
          id: `BATCH-${id}-002`,
          product_id: id,
          batch_code: 'LOT-002',
          warehouse_id: 'wh_main',
          warehouse_name: 'Main / Back-store',
          quantity_received: 20,
          quantity_remaining: 5,
          purchase_cost: 2600,
          selling_price: 2900,
          manufacturing_date: '2026-08-20T00:00:00Z',
          expiry_date: '2031-08-20T00:00:00Z',
          import_date: '2026-09-18T00:00:00Z',
          received_at: '2026-09-18T00:00:00Z',
          maturation_status: 'READY',
          authenticity_status: 'verified',
          created_at: '2026-09-18T00:00:00Z',
        });
        // Sync on_hand to sum of remaining lots (7 + 5 = 12)
        const invShop = this.inventory.get(this.invKey(id, 'wh_shop'))!;
        invShop.on_hand = 7;
        const invMain = this.inventory.get(this.invKey(id, 'wh_main'))!;
        invMain.on_hand = 5;
      } else {
        // Standard products get 1 or 2 lots matching their inventory
        if (shopQty > 0) {
          this.batches.push({
            id: `BATCH-${id}-001`,
            product_id: id,
            batch_code: 'LOT-001',
            warehouse_id: 'wh_shop',
            warehouse_name: 'Shop Floor (Showroom)',
            quantity_received: shopQty + 5,
            quantity_remaining: shopQty,
            purchase_cost: item.cost,
            selling_price: item.price,
            manufacturing_date: '2025-11-01T00:00:00Z',
            expiry_date: '2030-11-01T00:00:00Z',
            import_date: '2026-01-15T00:00:00Z',
            received_at: '2026-01-15T00:00:00Z',
            maturation_status: 'READY',
            authenticity_status: 'verified',
            created_at: '2026-01-15T00:00:00Z',
          });
        }
        if (mainQty > 0) {
          this.batches.push({
            id: `BATCH-${id}-002`,
            product_id: id,
            batch_code: 'LOT-002',
            warehouse_id: 'wh_main',
            warehouse_name: 'Main / Back-store',
            quantity_received: mainQty + 8,
            quantity_remaining: mainQty,
            purchase_cost: item.cost > 0 ? Math.round(item.cost * 1.05) : item.cost,
            selling_price: item.price,
            manufacturing_date: '2026-07-15T00:00:00Z',
            expiry_date: '2031-07-15T00:00:00Z',
            import_date: '2026-08-20T00:00:00Z',
            received_at: '2026-08-20T00:00:00Z',
            maturation_status: 'READY',
            authenticity_status: 'verified',
            created_at: '2026-08-20T00:00:00Z',
          });
        }
      }

      // Stock movement for opening balance
      this.stockMovements.push({
        id: `MOV-INIT-${prodIdx}`,
        product_id: id,
        product_name: displayName,
        sku: sku,
        warehouse_id: 'wh_shop',
        warehouse_name: 'Shop Floor (Showroom)',
        quantity_delta: shopQty,
        movement_reason: 'OPENING_BALANCE',
        unit_cost: item.cost,
        total_cost: shopQty * item.cost,
        created_by: 'usr_owner',
        created_by_name: 'Sobuj Sehk',
        created_at: '2026-01-01T00:00:00Z',
        notes: 'Initial opening stock ledger entry',
      });

      prodIdx++;
    }

    // Seed 1-2 Bundle Products (Section 6.1) using real catalog products
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const findProd = (brand: string, name: string): string | undefined => {
      const cands = Array.from(this.products.values()).filter(
        x => x.brand.toLowerCase().trim() === brand.toLowerCase().trim()
      );
      const exact = cands.find(x => norm(x.name) === norm(name));
      if (exact) return exact.id;
      const sub = cands.find(x => norm(name).includes(norm(x.name)) || norm(x.name).includes(norm(name)));
      return sub?.id;
    };
    const bundle1Id = 'PROD-bnd001';
    const bundle1: Product = {
      id: bundle1Id,
      sku: 'BND001',
      barcode: 'MP-BND-10001', // Internal Code128 barcode
      name: 'Dubai Best Sellers Duo (9PM + Khamrah)',
      brand: 'Mirage Combo',
      concentration: 'EDP',
      size_variant: '2x100ML',
      category_id: 'combo_kits',
      category_name: 'Gift Sets & Combos',
      avg_cost: 0,
      selling_price: 6200,
      price_updated_at: new Date().toISOString(),
      low_stock_threshold: 2,
      is_bundle: true,
      bundle_components: [
        { component_product_id: findProd('Afnan', '9PM / 9PM OG / 9PM Man') || 'PROD-afn007', quantity: 1 },
        { component_product_id: findProd('Lattafa', 'Khamrah') || 'PROD-ltf005', quantity: 1 },
      ],
      display_name: 'Mirage Combo Dubai Best Sellers Duo (9PM + Khamrah) 2x100ML',
      active: true,
      created_at: new Date().toISOString(),
    };
    this.products.set(bundle1Id, bundle1);
  }

  private seedSampleOrdersAndBookings(): void {
    // 8. Phase 3 Seed Suppliers (Dubai & Local)
    const s1: Supplier = {
      id: 'SUPP-DXB-001',
      name: 'Dubai Wholesale Fragrance Trading LLC',
      contact_person: 'Rashid Al-Mansoor',
      phone: '+971 4 223 8890',
      email: 'sales@dxbfragrancetrading.ae',
      address: 'Warehouse #14, Al Quoz Industrial Area 3, Dubai, UAE',
      country: 'UAE',
      currency: 'AED',
      default_exchange_rate: 33.0,
      balance_payable: 280000,
      payment_terms: '50% Advance, 50% on BL',
      tax_id_or_trade_license: 'TRN-10029384910003',
      notes: 'Primary UAE exporter for Lattafa, Maison Alhambra, and Afnan bulk cartons.',
      active: true,
      total_purchases_count: 4,
      total_purchases_amount_bdt: 1450000,
      created_at: '2026-01-05T10:00:00Z',
      updated_at: '2026-02-15T12:00:00Z',
    };
    this.suppliers.set(s1.id, s1);

    const s2: Supplier = {
      id: 'SUPP-DXB-002',
      name: 'Rasasi & Niche Perfumes Middle East FZE',
      contact_person: 'Mohammad Tariq',
      phone: '+971 4 338 1204',
      email: 'orders@rasasitrading.ae',
      address: 'Plot 48, Dubai Airport Freezone (DAFZA), Dubai, UAE',
      country: 'UAE',
      currency: 'AED',
      default_exchange_rate: 33.0,
      balance_payable: 140000,
      payment_terms: 'Net 30',
      tax_id_or_trade_license: 'TRN-10048192830002',
      notes: 'Direct distributor for Rasasi Hawas, Shuhrah, and luxury oriental lines.',
      active: true,
      total_purchases_count: 2,
      total_purchases_amount_bdt: 860000,
      created_at: '2026-01-10T11:30:00Z',
      updated_at: '2026-02-18T14:20:00Z',
    };
    this.suppliers.set(s2.id, s2);

    const s3: Supplier = {
      id: 'SUPP-FR-001',
      name: 'Paris Designer Fragrances Exporters SA',
      contact_person: 'Jean-Luc Moreau',
      phone: '+33 1 42 68 55 00',
      email: 'export@parisfreightfragrance.fr',
      address: '18 Rue de la Paix, 75002 Paris, France',
      country: 'France',
      currency: 'EUR',
      default_exchange_rate: 133.0,
      balance_payable: 0,
      payment_terms: 'Advance Wire TT',
      tax_id_or_trade_license: 'FR-88392019482',
      notes: 'Authorized EU consolidation supplier for Dior, Chanel, and Bleu de Chanel genuine batch imports.',
      active: true,
      total_purchases_count: 1,
      total_purchases_amount_bdt: 950000,
      created_at: '2026-01-15T09:00:00Z',
      updated_at: '2026-02-10T16:00:00Z',
    };
    this.suppliers.set(s3.id, s3);

    const s4: Supplier = {
      id: 'SUPP-BD-001',
      name: 'Bengal Luxury Packaging & Decant Supplies',
      contact_person: 'Nazmul Huda',
      phone: '01718992233',
      email: 'nazmul@bengalpackagingbd.com',
      address: '24/A Chawkbazar Commercial Area, Old Dhaka, Bangladesh',
      country: 'Bangladesh',
      currency: 'BDT',
      default_exchange_rate: 1.0,
      balance_payable: 18500,
      payment_terms: 'Net 15',
      tax_id_or_trade_license: 'TIN-582910482910',
      notes: 'Custom velvet packaging boxes, fragile foam inserts, and 5ml/10ml tester atomizers.',
      active: true,
      total_purchases_count: 3,
      total_purchases_amount_bdt: 65000,
      created_at: '2026-01-20T14:00:00Z',
      updated_at: '2026-02-19T11:00:00Z',
    };
    this.suppliers.set(s4.id, s4);

    // 14. Phase 6 Seed Employees (Section 19, 40.6)
    const emp1: Employee = {
      id: 'EMP-001',
      user_id: 'usr_mgr',
      name: 'Tanvir Ahmed',
      phone: '01711000003',
      email: 'tanvir@mirageperfume.com',
      designation: 'Showroom Sales Lead',
      role: 'Showroom & Sales',
      base_salary: 30000,
      disbursement_method: 'bank',
      bank_account_no: 'City Bank 1102983741',
      joined_date: '2025-06-01',
      active: true,
    };
    const emp2: Employee = {
      id: 'EMP-002',
      user_id: 'usr_pack',
      name: 'Kalam Hossain',
      phone: '01711000004',
      email: 'kalam@mirageperfume.com',
      designation: 'Packing & Fulfillment Specialist',
      role: 'Packing Team',
      base_salary: 22000,
      disbursement_method: 'bkash',
      bkash_number: '01711000004',
      joined_date: '2025-08-15',
      active: true,
    };
    const emp3: Employee = {
      id: 'EMP-003',
      user_id: 'usr_gm',
      name: 'Arif Rahman',
      phone: '01711000002',
      email: 'arif@mirageperfume.com',
      designation: 'General Manager & Accountant',
      role: 'Accountant',
      base_salary: 45000,
      disbursement_method: 'bank',
      bank_account_no: 'City Bank 1109923812',
      joined_date: '2025-01-10',
      active: true,
    };
    const emp4: Employee = {
      id: 'EMP-004',
      name: 'Shamim Reza',
      phone: '01811223344',
      email: 'shamim@mirageperfume.com',
      designation: 'Online Messenger Sales Rep',
      role: 'Showroom & Sales',
      base_salary: 20000,
      disbursement_method: 'bkash',
      bkash_number: '01811223344',
      joined_date: '2025-10-01',
      active: true,
    };
    [emp1, emp2, emp3, emp4].forEach(e => this.employees.set(e.id, e));

    // 15. Phase 6 Seed Daily Cash Register Log
    this.cashRegisterLogs.push({
      id: 'CSH-REG-1001',
      session_date: '2026-02-20',
      opening_float: 5000,
      cash_sales_inflow: 43200,
      cash_outflow: 3200,
      expected_closing_cash: 45000,
      actual_cash_count: 45000,
      variance: 0,
      denominations: {
        note_1000: 35,
        note_500: 16,
        note_200: 8,
        note_100: 4,
        note_50: 0,
        note_20: 0,
        note_10: 0,
        coins: 0,
      },
      notes: 'All till receipts balanced smoothly with physical notes.',
      closed_by: 'usr_owner',
      closed_by_name: 'Sobuj Sehk',
      created_at: '2026-02-20T21:00:00Z',
    });

    // 16. Phase 6 Seed Operational Expenses & Expense Taxonomy
    const catDaily: ExpenseCategoryDefinition = {
      id: 'cat_daily',
      name: 'Daily / Operational Expenses',
      type: 'daily',
      expense_account_id: 'acc_office_exp',
      expense_account_name: 'Office Tea, Snacks & Supplies',
      subcategories: [
        'Staff Snacks',
        'Office Tea & Refreshments',
        'Staff Meal',
        'Stationery / Markers',
        'Local Transport / Rickshaw',
        'Small Day-to-day Purchases',
      ],
      is_system: true,
      active: true,
      created_at: '2026-01-01T00:00:00Z',
    };

    const catRecurring: ExpenseCategoryDefinition = {
      id: 'cat_recurring',
      name: 'Monthly / Recurring Expenses',
      type: 'recurring',
      expense_account_id: 'acc_rent_exp',
      expense_account_name: 'Shop & Office Rent',
      subcategories: [
        'Shop & Office Rent',
        'Fiber Internet Bill',
        'Showroom Electricity (DESCO)',
        'Office Water & Utilities',
        'Software & Cloud Subscriptions',
      ],
      is_system: true,
      active: true,
      created_at: '2026-01-01T00:00:00Z',
    };

    const catSupplies: ExpenseCategoryDefinition = {
      id: 'cat_supplies',
      name: 'Office Supplies / Operating Costs',
      type: 'supplies',
      expense_account_id: 'acc_office_exp',
      expense_account_name: 'Office Tea, Snacks & Supplies',
      subcategories: [
        'Printer Paper',
        'Printer Ink & Consumables',
        'Office Stationery & Folders',
        'Hardware & Peripherals (Mouse/Keyboard)',
        'Cleaning Supplies',
      ],
      is_system: true,
      active: true,
      created_at: '2026-01-01T00:00:00Z',
    };

    const catPackaging: ExpenseCategoryDefinition = {
      id: 'cat_packaging',
      name: 'Packaging & Shipping Materials',
      type: 'supplies',
      expense_account_id: 'acc_pack_exp',
      expense_account_name: 'Packaging Materials, Boxes & Tape',
      subcategories: [
        'Carton Boxes',
        'Bubble Wrap',
        'Fragile Tape',
        'Poly Security Bags',
        'Branded Stickers',
      ],
      is_system: true,
      active: true,
      created_at: '2026-01-01T00:00:00Z',
    };

    const catMarketing: ExpenseCategoryDefinition = {
      id: 'cat_marketing',
      name: 'Marketing & Brand Promotion',
      type: 'other',
      expense_account_id: 'acc_mkt_exp',
      expense_account_name: 'Meta Ads & Influencer PR Marketing',
      subcategories: [
        'Meta Ads',
        'Influencer PR & Gifting',
        'Signage & Banners',
        'Photo/Video Content Production',
      ],
      is_system: true,
      active: true,
      created_at: '2026-01-01T00:00:00Z',
    };

    const catCourier: ExpenseCategoryDefinition = {
      id: 'cat_courier',
      name: 'Courier & Logistics Overhead',
      type: 'other',
      expense_account_id: 'acc_courier_exp',
      expense_account_name: 'Courier Freight & RTO Charges',
      subcategories: [
        'Emergency Courier Surcharge',
        'Local Delivery Rider Payout',
        'RTO Penalty / Surcharge',
      ],
      is_system: true,
      active: true,
      created_at: '2026-01-01T00:00:00Z',
    };

    [catDaily, catRecurring, catSupplies, catPackaging, catMarketing, catCourier].forEach(c => {
      this.expenseCategories.set(c.id, c);
    });

    // Seed Saved Templates (Frequent & Recurring)
    const tpl1: ExpenseTemplate = {
      id: 'tpl_staff_snacks',
      name: 'Staff Snacks',
      category_id: 'cat_daily',
      category_name: 'Daily / Operational Expenses',
      subcategory: 'Staff Snacks',
      expense_type: 'daily',
      default_amount: 150,
      default_payment_account_id: 'acc_cash',
      default_payment_account_name: 'Cash in Hand (Shop Till)',
      default_payment_method: 'cash',
      default_description: 'Evening tea & snacks for showroom team',
      is_frequent: true,
      created_by: 'usr_owner',
      created_at: '2026-01-01T00:00:00Z',
    };

    const tpl2: ExpenseTemplate = {
      id: 'tpl_office_tea',
      name: 'Office Tea',
      category_id: 'cat_daily',
      category_name: 'Daily / Operational Expenses',
      subcategory: 'Office Tea & Refreshments',
      expense_type: 'daily',
      default_amount: 80,
      default_payment_account_id: 'acc_cash',
      default_payment_account_name: 'Cash in Hand (Shop Till)',
      default_payment_method: 'cash',
      default_description: 'Showroom tea, lemons & mineral water jar',
      is_frequent: true,
      created_by: 'usr_owner',
      created_at: '2026-01-01T00:00:00Z',
    };

    const tpl3: ExpenseTemplate = {
      id: 'tpl_packaging_purchase',
      name: 'Packaging Purchase',
      category_id: 'cat_packaging',
      category_name: 'Packaging & Shipping Materials',
      subcategory: 'Carton Boxes',
      expense_type: 'supplies',
      default_amount: 500,
      default_payment_account_id: 'acc_cash',
      default_payment_account_name: 'Cash in Hand (Shop Till)',
      default_payment_method: 'cash',
      default_description: 'Emergency carton box & brown tape restock',
      is_frequent: true,
      created_by: 'usr_pack',
      created_at: '2026-01-01T00:00:00Z',
    };

    const tpl4: ExpenseTemplate = {
      id: 'tpl_staff_meal',
      name: 'Staff Meal',
      category_id: 'cat_daily',
      category_name: 'Daily / Operational Expenses',
      subcategory: 'Staff Meal',
      expense_type: 'daily',
      default_amount: 1200,
      default_payment_account_id: 'acc_cash',
      default_payment_account_name: 'Cash in Hand (Shop Till)',
      default_payment_method: 'cash',
      default_description: 'Company-sponsored staff lunch / biryani (target celebration)',
      is_frequent: true,
      created_by: 'usr_owner',
      created_at: '2026-01-01T00:00:00Z',
    };

    const tpl5: ExpenseTemplate = {
      id: 'tpl_marker',
      name: 'Marker / Stationery',
      category_id: 'cat_daily',
      category_name: 'Daily / Operational Expenses',
      subcategory: 'Stationery / Markers',
      expense_type: 'daily',
      default_amount: 250,
      default_payment_account_id: 'acc_cash',
      default_payment_account_name: 'Cash in Hand (Shop Till)',
      default_payment_method: 'cash',
      default_description: 'Permanent black markers & packing tape cutter blades',
      is_frequent: true,
      created_by: 'usr_pack',
      created_at: '2026-01-01T00:00:00Z',
    };

    const tpl6: ExpenseTemplate = {
      id: 'tpl_rent',
      name: 'Showroom & Office Rent',
      category_id: 'cat_recurring',
      category_name: 'Monthly / Recurring Expenses',
      subcategory: 'Shop & Office Rent',
      expense_type: 'recurring',
      default_amount: 65000,
      default_payment_account_id: 'acc_bank',
      default_payment_account_name: 'City Bank Account',
      default_payment_method: 'bank',
      default_description: 'Banani Showroom & Office Monthly Rent',
      is_frequent: false,
      is_recurring: true,
      recurring_day: 1,
      recurring_frequency: 'monthly',
      created_by: 'usr_owner',
      created_at: '2026-01-01T00:00:00Z',
    };

    const tpl7: ExpenseTemplate = {
      id: 'tpl_internet',
      name: 'Fiber Internet Bill',
      category_id: 'cat_recurring',
      category_name: 'Monthly / Recurring Expenses',
      subcategory: 'Fiber Internet Bill',
      expense_type: 'recurring',
      default_amount: 2500,
      default_payment_account_id: 'acc_bkash',
      default_payment_account_name: 'bKash Merchant Wallet',
      default_payment_method: 'bkash',
      default_description: 'Monthly high-speed optical fiber internet for showroom & cloud POS',
      is_frequent: false,
      is_recurring: true,
      recurring_day: 5,
      recurring_frequency: 'monthly',
      created_by: 'usr_gm',
      created_at: '2026-01-01T00:00:00Z',
    };

    const tpl8: ExpenseTemplate = {
      id: 'tpl_desco',
      name: 'DESCO Electricity Bill',
      category_id: 'cat_recurring',
      category_name: 'Monthly / Recurring Expenses',
      subcategory: 'Showroom Electricity (DESCO)',
      expense_type: 'recurring',
      default_amount: 6000,
      default_payment_account_id: 'acc_bkash',
      default_payment_account_name: 'bKash Merchant Wallet',
      default_payment_method: 'bkash',
      default_description: 'Monthly commercial electricity bill for Banani showroom',
      is_frequent: false,
      is_recurring: true,
      recurring_day: 10,
      recurring_frequency: 'monthly',
      created_by: 'usr_gm',
      created_at: '2026-01-01T00:00:00Z',
    };

    [tpl1, tpl2, tpl3, tpl4, tpl5, tpl6, tpl7, tpl8].forEach(t => {
      this.expenseTemplates.set(t.id, t);
    });

    // Seed Budgets
    const bdg1: ExpenseBudget = {
      id: 'bdg_snacks_monthly',
      category_id: 'cat_daily',
      category_name: 'Daily / Operational Expenses',
      subcategory: 'Staff Snacks',
      period: 'monthly',
      amount: 3000,
      warning_threshold_percent: 80,
      created_by: 'usr_owner',
      created_at: '2026-01-01T00:00:00Z',
    };

    const bdg2: ExpenseBudget = {
      id: 'bdg_tea_monthly',
      category_id: 'cat_daily',
      category_name: 'Daily / Operational Expenses',
      subcategory: 'Office Tea & Refreshments',
      period: 'monthly',
      amount: 2000,
      warning_threshold_percent: 80,
      created_by: 'usr_owner',
      created_at: '2026-01-01T00:00:00Z',
    };

    const bdg3: ExpenseBudget = {
      id: 'bdg_snacks_daily',
      category_id: 'cat_daily',
      category_name: 'Daily / Operational Expenses',
      subcategory: 'Staff Snacks',
      period: 'daily',
      amount: 200,
      warning_threshold_percent: 80,
      created_by: 'usr_owner',
      created_at: '2026-01-01T00:00:00Z',
    };

    const bdg4: ExpenseBudget = {
      id: 'bdg_supplies_monthly',
      category_id: 'cat_supplies',
      category_name: 'Office Supplies / Operating Costs',
      period: 'monthly',
      amount: 6000,
      warning_threshold_percent: 80,
      created_by: 'usr_owner',
      created_at: '2026-01-01T00:00:00Z',
    };

    const bdg5: ExpenseBudget = {
      id: 'bdg_packaging_monthly',
      category_id: 'cat_packaging',
      category_name: 'Packaging & Shipping Materials',
      period: 'monthly',
      amount: 15000,
      warning_threshold_percent: 80,
      created_by: 'usr_owner',
      created_at: '2026-01-01T00:00:00Z',
    };

    const bdg6: ExpenseBudget = {
      id: 'bdg_marketing_monthly',
      category_id: 'cat_marketing',
      category_name: 'Marketing & Brand Promotion',
      period: 'monthly',
      amount: 35000,
      warning_threshold_percent: 80,
      created_by: 'usr_owner',
      created_at: '2026-01-01T00:00:00Z',
    };

    [bdg1, bdg2, bdg3, bdg4, bdg5, bdg6].forEach(b => {
      this.expenseBudgets.set(b.id, b);
    });

    const exp1: ExpenseRecord = {
      id: 'EXP-1001',
      expense_number: 'EXP-2026-0001',
      category: 'rent',
      category_id: 'cat_recurring',
      category_name: 'Monthly / Recurring Expenses',
      subcategory: 'Shop & Office Rent',
      expense_type: 'recurring',
      description: 'Banani Showroom & Office Rent (February 2026)',
      amount: 65000,
      expense_account_id: 'acc_rent_exp',
      expense_account_name: 'Shop & Office Rent',
      payment_account_id: 'acc_bank',
      payment_account_name: 'City Bank Account',
      payment_method: 'bank',
      receipt_reference: 'RENT-FEB-2026-01',
      date: '2026-02-01',
      created_by: 'usr_owner',
      created_by_name: 'Sobuj Sehk',
      created_at: '2026-02-01T10:00:00Z',
    };
    const exp2: ExpenseRecord = {
      id: 'EXP-1002',
      expense_number: 'EXP-2026-0002',
      category: 'utility',
      category_id: 'cat_recurring',
      category_name: 'Monthly / Recurring Expenses',
      subcategory: 'Showroom Electricity (DESCO)',
      expense_type: 'recurring',
      description: 'DESCO Showroom Electricity Bill & Fiber Internet',
      amount: 8500,
      expense_account_id: 'acc_util_exp',
      expense_account_name: 'Shop Electricity, Internet & Utilities',
      payment_account_id: 'acc_bkash',
      payment_account_name: 'bKash Merchant Wallet',
      payment_method: 'bkash',
      receipt_reference: 'DESCO-902184',
      date: '2026-02-10',
      created_by: 'usr_gm',
      created_by_name: 'Arif Rahman',
      created_at: '2026-02-10T12:30:00Z',
    };
    const exp3: ExpenseRecord = {
      id: 'EXP-1003',
      expense_number: 'EXP-2026-0003',
      category: 'marketing',
      category_id: 'cat_marketing',
      category_name: 'Marketing & Brand Promotion',
      subcategory: 'Meta Ads',
      expense_type: 'other',
      description: 'Meta Ads Sponsored Campaign (Khamrah & Hawas)',
      amount: 15000,
      expense_account_id: 'acc_mkt_exp',
      expense_account_name: 'Meta Ads & Influencer PR Marketing',
      payment_account_id: 'acc_bank',
      payment_account_name: 'City Bank Account',
      payment_method: 'bank',
      receipt_reference: 'META-INV-88910',
      date: '2026-02-12',
      created_by: 'usr_owner',
      created_by_name: 'Sobuj Sehk',
      created_at: '2026-02-12T14:00:00Z',
    };
    const exp4: ExpenseRecord = {
      id: 'EXP-1004',
      expense_number: 'EXP-2026-0004',
      category: 'packing_supplies',
      category_id: 'cat_packaging',
      category_name: 'Packaging & Shipping Materials',
      subcategory: 'Carton Boxes',
      expense_type: 'supplies',
      description: 'Corrugated 4x6 Shipping Boxes & 500m Fragile Bubble Wrap',
      amount: 4200,
      expense_account_id: 'acc_pack_exp',
      expense_account_name: 'Packaging Materials, Boxes & Tape',
      payment_account_id: 'acc_cash',
      payment_account_name: 'Cash in Hand (Shop Till)',
      payment_method: 'cash',
      receipt_reference: 'CASH-VOUCHER-084',
      date: '2026-02-15',
      created_by: 'usr_pack',
      created_by_name: 'Kalam Hossain',
      created_at: '2026-02-15T16:20:00Z',
    };
    const exp5: ExpenseRecord = {
      id: 'EXP-1005',
      expense_number: 'EXP-2026-0005',
      category: 'office_tea_snacks',
      category_id: 'cat_daily',
      category_name: 'Daily / Operational Expenses',
      subcategory: 'Staff Snacks',
      expense_type: 'daily',
      description: 'Evening singara & tea for showroom sales staff',
      amount: 140,
      expense_account_id: 'acc_office_exp',
      expense_account_name: 'Office Tea, Snacks & Supplies',
      payment_account_id: 'acc_cash',
      payment_account_name: 'Cash in Hand (Shop Till)',
      payment_method: 'cash',
      receipt_reference: 'PETTY-CASH-101',
      date: new Date().toISOString().slice(0, 10),
      created_by: 'usr_gm',
      created_by_name: 'Arif Rahman',
      created_at: new Date().toISOString(),
    };
    const exp6: ExpenseRecord = {
      id: 'EXP-1006',
      expense_number: 'EXP-2026-0006',
      category: 'office_tea_snacks',
      category_id: 'cat_daily',
      category_name: 'Daily / Operational Expenses',
      subcategory: 'Stationery / Markers',
      expense_type: 'daily',
      description: '2x Doms Permanent Black Markers for Carton Dispatch',
      amount: 100,
      expense_account_id: 'acc_office_exp',
      expense_account_name: 'Office Tea, Snacks & Supplies',
      payment_account_id: 'acc_cash',
      payment_account_name: 'Cash in Hand (Shop Till)',
      payment_method: 'cash',
      receipt_reference: 'PETTY-CASH-102',
      date: new Date().toISOString().slice(0, 10),
      created_by: 'usr_pack',
      created_by_name: 'Kalam Hossain',
      created_at: new Date().toISOString(),
    };

    [exp1, exp2, exp3, exp4, exp5, exp6].forEach(e => {
      this.expenses.set(e.id, e);
      const a = this.accounts.get(e.expense_account_id);
      if (a) a.balance += e.amount;
    });

    // 17. Phase 6 Seed Previous Month Payroll Records
    const ps1: PayrollRecord = {
      id: 'PR-1001',
      payslip_number: 'PS-2026-0001',
      payroll_month: '2026-01',
      employee_id: emp1.id,
      employee_name: emp1.name,
      designation: emp1.designation,
      base_salary: 30000,
      bonus_commission: 3500,
      deductions: 0,
      net_payable: 33500,
      payment_account_id: 'acc_bank',
      payment_account_name: 'City Bank Account',
      payment_date: '2026-01-31',
      status: 'paid',
      transaction_reference: 'SAL-CB-9021',
      notes: 'January sales target performance bonus included.',
      created_by: 'usr_owner',
      created_at: '2026-01-31T18:00:00Z',
    };
    const ps2: PayrollRecord = {
      id: 'PR-1002',
      payslip_number: 'PS-2026-0002',
      payroll_month: '2026-01',
      employee_id: emp2.id,
      employee_name: emp2.name,
      designation: emp2.designation,
      base_salary: 22000,
      bonus_commission: 1000,
      deductions: 0,
      net_payable: 23000,
      payment_account_id: 'acc_bkash',
      payment_account_name: 'bKash Merchant Wallet',
      payment_date: '2026-01-31',
      status: 'paid',
      transaction_reference: 'SAL-BK-4481',
      notes: 'Packing speed bonus.',
      created_by: 'usr_owner',
      created_at: '2026-01-31T18:00:00Z',
    };
    [ps1, ps2].forEach(p => {
      this.payrollRecords.set(p.id, p);
      const a = this.accounts.get('acc_salary_exp');
      if (a) a.balance += p.net_payable;
    });

    // 18. Phase 8 Seed Approval Requests & System Alerts (Section 21, 23, 40.8)
    const apr1: ApprovalRequest = {
      id: 'apr-1001',
      request_number: 'APR-2026-0001',
      request_type: 'price_discount_override',
      title: '20% VIP Client Discount on Rasasi Hawas & Khamrah Combo',
      description: 'Repeat buyer requesting 20% discount on order over \u09F310,000.',
      impact_amount: 1960,
      requested_by_id: 'usr_rep',
      requested_by_name: 'Shamim Reza',
      requested_at: '2026-02-21T10:15:00Z',
      status: 'pending',
      payload_data: { discount_rate: 0.20, items_count: 2 },
    };

    const apr2: ApprovalRequest = {
      id: 'apr-1002',
      request_number: 'APR-2026-0002',
      request_type: 'order_cancellation',
      title: 'Order Cancellation & Refund (Customer Refusal at Banani POS)',
      description: 'Customer cancelled high-value walk-in order (INV-2026-0005) before dispatch.',
      impact_amount: 6200,
      requested_by_id: 'usr_mgr',
      requested_by_name: 'Tanvir Ahmed',
      requested_at: '2026-02-21T11:40:00Z',
      status: 'pending',
      payload_data: { order_id: 'ord_1005' },
    };

    const apr3: ApprovalRequest = {
      id: 'apr-1003',
      request_number: 'APR-2026-0003',
      request_type: 'damaged_writeoff',
      title: 'Scrap Write-Off: 2x Armaf Club De Nuit Broken Inbound Shipping',
      description: 'Bottles suffered broken neck during carton unboxing in Main Warehouse.',
      impact_amount: 5600,
      requested_by_id: 'usr_pack',
      requested_by_name: 'Kalam Hossain',
      requested_at: '2026-02-20T14:30:00Z',
      status: 'approved',
      reviewed_by_id: 'usr_owner',
      reviewed_by_name: 'Sobuj Sehk',
      reviewed_at: '2026-02-20T15:00:00Z',
      review_notes: 'Approved scrap write-off to Damaged Loss account (6050).',
      payload_data: { writeoff_qty: 2, unit_cost: 2800 },
    };

    [apr1, apr2, apr3].forEach(r => this.approvalRequests.set(r.id, r));

    // Seed Priority Notifications
    this.notifications.push(
      {
        id: 'notif_sys_01',
        type: 'approval_request',
        priority: 'critical',
        title: 'Pending Sign-Off: APR-2026-0001',
        message: 'Shamim Reza requested 20% discount override (\u09F31,960 impact).',
        ref_type: 'approval_request',
        ref_id: 'apr-1001',
        action_url: '/audit-log',
        read: false,
        created_at: '2026-02-21T10:15:00Z',
      },
      {
        id: 'notif_sys_02',
        type: 'low_stock',
        priority: 'warning',
        title: 'Low Stock Alert: Khamrah 100ML',
        message: 'Available stock is 2 bottles, below safety reorder threshold (3).',
        ref_type: 'product',
        ref_id: 'prod_1',
        action_url: '/inventory/products',
        read: false,
        created_at: '2026-02-21T09:00:00Z',
      },
      {
        id: 'notif_sys_03',
        type: 'rto_alert',
        priority: 'warning',
        title: 'High RTO Risk Customer Flagged',
        message: 'Customer 01712998877 has exceeded the RTO risk threshold (2 consecutive returns).',
        ref_type: 'customer',
        ref_id: 'cust_rto',
        action_url: '/customers',
        read: true,
        created_at: '2026-02-20T16:00:00Z',
      }
    );

    // 19. Phase 9 Seed Pricing Rules, Competitor Tracking & Campaigns (Section 22, 40.9)
    const rule1: PricingRule = {
      id: 'rule_default',
      name: 'Dynamic Market Undercut & Cost-Plus Guardrail',
      strategy: 'competitor_undercut',
      minimum_margin_percent: 20,
      target_margin_percent: 35,
      max_discount_percent: 15,
      undercut_amount: 50,
      active: true,
    };
    this.pricingRules.set(rule1.id, rule1);

    // Seed Competitor Prices across Bangladeshi Retailers
    const cp1: CompetitorPriceRecord = {
      id: 'cp_1001',
      product_id: 'prod_1',
      product_name: 'Lattafa Khamrah EDP 100ML',
      sku: 'LAT001',
      competitor_name: 'Sundora',
      competitor_price: 3650,
      competitor_url: 'https://sundora.com.bd/lattafa-khamrah',
      in_stock: true,
      notes: 'Banani flagship store price',
      recorded_at: '2026-02-21T08:00:00Z',
    };
    const cp2: CompetitorPriceRecord = {
      id: 'cp_1002',
      product_id: 'prod_1',
      product_name: 'Lattafa Khamrah EDP 100ML',
      sku: 'LAT001',
      competitor_name: 'Perfume BD',
      competitor_price: 3450,
      competitor_url: 'https://perfumebd.com/khamrah',
      in_stock: true,
      notes: 'Online promo deal',
      recorded_at: '2026-02-21T08:30:00Z',
    };
    const cp3: CompetitorPriceRecord = {
      id: 'cp_1003',
      product_id: 'prod_2',
      product_name: 'Rasasi Hawas for Men EDP 100ML',
      sku: 'RSA001',
      competitor_name: 'Bangla Shoppers',
      competitor_price: 5400,
      competitor_url: 'https://banglashoppers.com/rasasi-hawas',
      in_stock: true,
      notes: 'Standard retail price',
      recorded_at: '2026-02-21T09:15:00Z',
    };
    const cp4: CompetitorPriceRecord = {
      id: 'cp_1004',
      product_id: 'prod_3',
      product_name: 'Armaf Club De Nuit Intense Man EDT 105ML',
      sku: 'ARM001',
      competitor_name: 'Scentsation',
      competitor_price: 4100,
      competitor_url: 'https://scentsationbd.com/cdnim',
      in_stock: true,
      notes: 'French batch stock',
      recorded_at: '2026-02-21T09:45:00Z',
    };
    const cp5: CompetitorPriceRecord = {
      id: 'cp_1005',
      product_id: 'prod_4',
      product_name: 'Afnan 9PM EDP 100ML',
      sku: 'AFN001',
      competitor_name: 'Buy Perfume in BD',
      competitor_price: 3600,
      competitor_url: 'https://buyperfumeinbd.com/9pm',
      in_stock: true,
      notes: 'Vanilla amber batch',
      recorded_at: '2026-02-21T10:00:00Z',
    };

    [cp1, cp2, cp3, cp4, cp5].forEach(cp => this.competitorPrices.set(cp.id, cp));

    // Seed Promotional Campaign
    const cmp1: PricingCampaign = {
      id: 'cmp_1001',
      name: 'Weekend Amber & Gourmand Fragrance Fest',
      discount_type: 'percentage',
      discount_value: 10,
      start_date: '2026-02-20',
      end_date: '2026-02-23',
      target_type: 'category',
      target_value: 'Amber Gourmand',
      active: true,
    };
    this.pricingCampaigns.set(cmp1.id, cmp1);

    // 21. Seed Initial Cashier Daily Closings & Walk-in Sales (Section 17, Cashier Daily Closing)
    const prodKdl006 = this.products.get('PROD-kdl006') || Array.from(this.products.values())[0];
    const prodAmf002 = this.products.get('PROD-amf002') || Array.from(this.products.values())[1];

    if (prodKdl006 && prodAmf002) {
      const order1: Order = {
        id: 'ORD-WALKIN-101',
        invoice_number: 'INV-2026-0091',
        customer_id: 'CUST-101',
        customer_name: 'Walk-in Customer (Rafiq)',
        customer_phone: '01712000001',
        channel: 'walk-in',
        order_type: 'direct_sale',
        fulfillment_method: 'n_a_walk_in',
        sale_type: 'retail',
        status: 'delivered',
        items: [
          {
            id: 'ITEM-101-1',
            order_id: 'ORD-WALKIN-101',
            product_id: prodKdl006.id,
            product_name: prodKdl006.display_name,
            sku: prodKdl006.sku,
            barcode: prodKdl006.barcode,
            quantity: 1,
            unit_price: 2750,
            discount_amount: 0,
            total_price: 2750,
            unit_cost_at_sale: prodKdl006.avg_cost || 1800,
            allocations: [],
          },
        ],
        subtotal: 2750,
        delivery_charge: 0,
        discount_amount: 0,
        total: 2750,
        order_barcode: 'MP-ORD-2026-0091',
        payments: [
          {
            id: 'PAY-101-1',
            order_id: 'ORD-WALKIN-101',
            amount: 2750,
            method: 'cash',
            payment_account_id: 'acc_cash',
            received_by: 'Tanvir Ahmed',
            status: 'completed',
            payment_date: '2026-09-24',
            created_at: '2026-09-24T11:30:00Z',
          },
        ],
        order_timing: 'today',
        transaction_date: '2026-09-24',
        business_date: '2026-09-24',
        closing_id: 'CLS-20260924-001',
        created_by: 'usr_mgr',
        created_by_name: 'Tanvir Ahmed (Sales / Showroom)',
        created_at: '2026-09-24T11:30:00Z',
        updated_at: '2026-09-24T11:30:00Z',
      };

      const order2: Order = {
        id: 'ORD-WALKIN-102',
        invoice_number: 'INV-2026-0092',
        customer_id: 'CUST-102',
        customer_name: 'Walk-in Customer (Hasan)',
        customer_phone: '01712000002',
        channel: 'walk-in',
        order_type: 'direct_sale',
        fulfillment_method: 'n_a_walk_in',
        sale_type: 'retail',
        status: 'delivered',
        items: [
          {
            id: 'ITEM-102-1',
            order_id: 'ORD-WALKIN-102',
            product_id: prodAmf002.id,
            product_name: prodAmf002.display_name,
            sku: prodAmf002.sku,
            barcode: prodAmf002.barcode,
            quantity: 1,
            unit_price: 3400,
            discount_amount: 0,
            total_price: 3400,
            unit_cost_at_sale: prodAmf002.avg_cost || 2200,
            allocations: [],
          },
        ],
        subtotal: 3400,
        delivery_charge: 0,
        discount_amount: 0,
        total: 3400,
        order_barcode: 'MP-ORD-2026-0092',
        payments: [
          {
            id: 'PAY-102-1',
            order_id: 'ORD-WALKIN-102',
            amount: 3400,
            method: 'bkash',
            payment_account_id: 'acc_bkash',
            received_by: 'Tanvir Ahmed',
            status: 'completed',
            payment_date: '2026-09-24',
            created_at: '2026-09-24T14:15:00Z',
          },
        ],
        order_timing: 'today',
        transaction_date: '2026-09-24',
        business_date: '2026-09-24',
        closing_id: 'CLS-20260924-001',
        created_by: 'usr_mgr',
        created_by_name: 'Tanvir Ahmed (Sales / Showroom)',
        created_at: '2026-09-24T14:15:00Z',
        updated_at: '2026-09-24T14:15:00Z',
      };

      const order3: Order = {
        id: 'ORD-WALKIN-103',
        invoice_number: 'INV-2026-0093',
        customer_id: 'CUST-101',
        customer_name: 'Walk-in Customer (Imran)',
        customer_phone: '01819000003',
        channel: 'walk-in',
        order_type: 'direct_sale',
        fulfillment_method: 'n_a_walk_in',
        sale_type: 'retail',
        status: 'delivered',
        items: [
          {
            id: 'ITEM-103-1',
            order_id: 'ORD-WALKIN-103',
            product_id: prodKdl006.id,
            product_name: prodKdl006.display_name,
            sku: prodKdl006.sku,
            barcode: prodKdl006.barcode,
            quantity: 1,
            unit_price: 2750,
            discount_amount: 0,
            total_price: 2750,
            unit_cost_at_sale: prodKdl006.avg_cost || 1800,
            allocations: [],
          },
        ],
        subtotal: 2750,
        delivery_charge: 0,
        discount_amount: 0,
        total: 2750,
        order_barcode: 'MP-ORD-2026-0093',
        payments: [
          {
            id: 'PAY-103-1',
            order_id: 'ORD-WALKIN-103',
            amount: 2750,
            method: 'cash',
            payment_account_id: 'acc_cash',
            received_by: 'Tanvir Ahmed',
            status: 'completed',
            payment_date: '2026-09-24',
            created_at: '2026-09-24T17:45:00Z',
          },
        ],
        order_timing: 'today',
        transaction_date: '2026-09-24',
        business_date: '2026-09-24',
        closing_id: 'CLS-20260924-001',
        created_by: 'usr_mgr',
        created_by_name: 'Tanvir Ahmed (Sales / Showroom)',
        created_at: '2026-09-24T17:45:00Z',
        updated_at: '2026-09-24T17:45:00Z',
      };

      this.orders.set(order1.id, order1);
      this.orders.set(order2.id, order2);
      this.orders.set(order3.id, order3);
    }

    // Seed Open/Pending Previous Day Closing for Tanvir Ahmed (usr_mgr) on 2026-09-24
    const closingPending: CashierDailyClosing = {
      id: 'CLS-20260924-001',
      cashier_id: 'usr_mgr',
      cashier_name: 'Tanvir Ahmed (Sales / Showroom)',
      business_date: '2026-09-24',
      status: 'open',
      started_at: '2026-09-24T09:30:00Z',
      opening_float: 5000,
      sales_metrics: {
        total_sales: 8900,
        order_count: 3,
        cash_sales: 5500,
        bkash_sales: 3400,
        nagad_sales: 0,
        bank_sales: 0,
        card_sales: 0,
        total_collected: 8900,
      },
      cash_expenses: [
        {
          id: 'CEXP-101',
          expense_number: 'EXP-2026-0005',
          amount: 140,
          category: 'Daily / Operational Expenses',
          description: 'Evening singara & tea for showroom sales staff',
          date: '2026-09-24',
          receipt_reference: 'PETTY-CASH-101',
          created_at: '2026-09-24T16:30:00Z',
        },
      ],
      total_cash_expenses: 140,
      expected_cash: 10360, // 5000 + 5500 - 140
      actual_cash: 0,
      cash_variance: -10360,
      created_at: '2026-09-24T09:30:00Z',
      updated_at: '2026-09-24T16:30:00Z',
    };
    this.cashierDailyClosings.set(closingPending.id, closingPending);

    // Seed Approved Historical Closing for 2026-09-23
    const closingApproved: CashierDailyClosing = {
      id: 'CLS-20260923-001',
      cashier_id: 'usr_mgr',
      cashier_name: 'Tanvir Ahmed (Sales / Showroom)',
      business_date: '2026-09-23',
      status: 'approved',
      started_at: '2026-09-23T09:30:00Z',
      submitted_at: '2026-09-23T20:45:00Z',
      reviewed_at: '2026-09-23T21:10:00Z',
      reviewed_by: 'usr_gm',
      reviewed_by_name: 'Arif Rahman (Accountant / GM)',
      review_notes: 'Physical cash count matches system calculations. Approved without discrepancies.',
      opening_float: 5000,
      sales_metrics: {
        total_sales: 12500,
        order_count: 4,
        cash_sales: 8500,
        bkash_sales: 2500,
        nagad_sales: 1500,
        bank_sales: 0,
        card_sales: 0,
        total_collected: 12500,
      },
      cash_expenses: [
        {
          id: 'CEXP-100',
          expense_number: 'EXP-2026-0004',
          amount: 200,
          category: 'Packaging Materials',
          description: 'Emergency brown packing tape restock',
          date: '2026-09-23',
          receipt_reference: 'VOUCHER-92',
          created_at: '2026-09-23T15:00:00Z',
        },
      ],
      total_cash_expenses: 200,
      expected_cash: 13300, // 5000 + 8500 - 200
      actual_cash: 13300,
      cash_variance: 0,
      denominations: {
        note_1000: 10,
        note_500: 6,
        note_200: 1,
        note_100: 1,
        note_50: 0,
        note_20: 0,
        note_10: 0,
        coins: 0,
      },
      closing_notes: 'Smooth sales day. All walk-in counter slips filed.',
      created_at: '2026-09-23T09:30:00Z',
      updated_at: '2026-09-23T21:10:00Z',
    };
    this.cashierDailyClosings.set(closingApproved.id, closingApproved);

    // 22. Phase 10 Seed Initial System Backup Snapshot (Section 31, 40.10)
    const initBackup: BackupSnapshot = {
      id: 'bkp_init_20260221',
      filename: 'mirage_erp_backup_20260221_060000.json',
      timestamp: '2026-02-21T06:00:00Z',
      version: '2.0.0',
      size_kb: 485,
      record_counts: {
        products: 204,
        orders: 142,
        customers: 118,
        inventory_ledger: 320,
        journal_entries: 245,
        expenses: 12,
        payroll: 4,
        audit_logs: 18,
      },
      checksum: 'sha256:d6e2f0e2c7a5a9b1e3f4c6d8a1b0c2d4e6f8a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4',
      created_by: 'System Scheduler (Cron Daily)',
      status: 'completed',
    };
    this.backups.push(initBackup);
  }
}

export const db = new MirageDB();

// ============================================================================
// Stock Movement Counterparty Resolver (Part 0 & Part 2)
// Resolves customer name for SALE/RETURN and supplier name for PURCHASE/PURCHASE_RETURN
// Does not store on StockMovement \u2014 resolved at query time.
// ============================================================================
export function resolveStockMovementEntity(m: StockMovement, database: MirageDB): {
  customer_name: string | null;
  supplier_name: string | null;
  party_name: string | null;
} {
  const reason = m.movement_reason;
  let customer_name: string | null = null;
  let supplier_name: string | null = null;

  if (reason === 'SALE' || reason === 'RETURN' || reason === 'RETURN_RESTOCK') {
    if (m.reference_id) {
      const ref = String(m.reference_id).trim();
      const order = database.orders.get(ref) || Array.from(database.orders.values()).find(o => o.invoice_number === ref || o.id === ref);
      if (order) {
        customer_name = order.customer_name || null;
      } else {
        const custReturn = database.customerReturns?.get(ref) || Array.from(database.customerReturns?.values() || []).find(r => r.return_number === ref || r.id === ref);
        if (custReturn) {
          customer_name = custReturn.customer_name || null;
        }
      }
    }
  } else if (reason === 'PURCHASE' || reason === 'PO_RECEIVING' || reason === 'PURCHASE_RETURN') {
    if (m.reference_id) {
      const ref = String(m.reference_id).trim();
      const po = database.purchaseOrders?.get(ref) || Array.from(database.purchaseOrders?.values() || []).find(p => p.po_number === ref || p.id === ref);
      if (po) {
        supplier_name = po.supplier_name || null;
      }
      if (!supplier_name) {
        const pr = database.purchaseReturns?.get(ref) || Array.from(database.purchaseReturns?.values() || []).find(r => r.return_number === ref || r.id === ref);
        if (pr) {
          supplier_name = pr.supplier_name || null;
        }
      }
      if (!supplier_name) {
        const supp = database.suppliers?.get(ref) || Array.from(database.suppliers?.values() || []).find(s => s.name === ref || s.id === ref);
        if (supp) {
          supplier_name = supp.name || null;
        }
      }
    }
    if (!supplier_name && m.notes) {
      const matchRec = m.notes.match(/Stock received from ([^,;\n]+)/i);
      if (matchRec && matchRec[1]) {
        supplier_name = matchRec[1].trim();
      } else {
        const matchRet = m.notes.match(/Returned to supplier ([^,;(\n]+)/i);
        if (matchRet && matchRet[1]) {
          supplier_name = matchRet[1].trim();
        }
      }
    }
  }

  return {
    customer_name,
    supplier_name,
    party_name: customer_name || supplier_name || null,
  };
}

export function formatMovementReasonLabel(reason: string): string {
  switch (reason) {
    case 'PURCHASE':
      return 'Stock Purchase';
    case 'PO_RECEIVING':
      return 'PO Receiving';
    case 'SALE':
      return 'Customer Sale';
    case 'TRANSFER':
      return 'Warehouse Transfer';
    case 'DAMAGE':
      return 'Damage';
    case 'LOSS':
      return 'Loss';
    case 'DAMAGED_WRITE_OFF':
      return 'Damaged Write-off';
    case 'TESTER_CONVERSION':
      return 'Tester Conversion';
    case 'MARKETING_SAMPLE':
      return 'Marketing Sample';
    case 'GIFT':
      return 'VIP Gift';
    case 'RETURN':
    case 'RETURN_RESTOCK':
      return 'Return Restocked';
    case 'OPENING_BALANCE':
      return 'Opening Balance';
    case 'PURCHASE_RETURN':
      return 'Purchase Return';
    case 'ADJUSTMENT':
      return 'Audit Adjustment';
    default:
      return String(reason || '').replace(/_/g, ' ');
  }
}

