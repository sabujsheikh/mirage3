/**
 * Canonical Data Model & Types for Mirage Perfume ERP
 * Grounded in AGENTS.md (Section 6, 8, 15, 18, 20, 35, 41)
 */

export type UserRoleTier = 1 | 2 | 3 | 4;
export type UserTier = 'owner' | 'general_manager' | 'manager' | 'packing_staff';

export type Capability =
  | 'view_sales_orders'
  | 'view_inventory_stock'
  | 'view_cost_margin'
  | 'view_full_accounting_pnl'
  | 'view_salary_data'
  | 'create_edit_orders'
  | 'cancel_orders'
  | 'pack_orders'
  | 'dispatch_orders'
  | 'edit_product_prices'
  | 'create_edit_products'
  | 'receive_stock'
  | 'transfer_stock'
  | 'adjust_stock'
  | 'view_accounts'
  | 'manage_accounts'
  | 'manage_users'
  | 'manage_purchases'
  | 'manage_suppliers'
  | 'manage_accounting'
  | 'receive_inventory'
  | 'system_settings'
  | 'view_audit_log'
  | 'view_hr_module'
  | 'manage_hr'
  | 'manage_payroll'
  | 'approve_leave'
  | 'approve_attendance'
  | 'view_own_employee_portal'
  | 'view_crm'
  | 'manage_crm'
  | 'manage_leads'
  | 'manage_tasks'
  | 'manage_tickets'
  | 'export_crm'
  | 'view_sales_financial_ledger';

export type PermissionToggle = Capability;

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  profile_photo_url?: string;
  password?: string;
  tier: UserRoleTier;
  role: string;
  active: boolean;
  totp_enabled?: boolean;
  two_factor_enabled?: boolean;
  two_factor_secret?: string;
  backup_codes?: string[];
  last_login_at?: string;
  capabilities: Capability[];
  toggles: Record<string, boolean>;
  created_at: string;
}

export type PerfumeConcentration = 'EDP' | 'EDT' | 'Extrait' | 'Parfum' | 'Cologne' | 'Attar' | 'Concentrated Oil';

// Top-level product classification (Middle Eastern / Western / Niche).
// Keep intentionally to these three for now; Designer is a future
// sub-classification, not a fourth top-level value.
export type PerfumeType = 'Middle Eastern' | 'Western' | 'Niche';

export interface BundleComponent {
  component_product_id: string;
  quantity: number;
}

export interface WarehouseStockLevel {
  warehouse_id: string;
  warehouse_name: string;
  on_hand: number;
  reserved: number;
  available: number;
}

export interface Product {
  id: string;
  barcode: string; // Manufacturer barcode or generated internal Code128
  sku: string; // Internal SKU e.g. KDL006, AMF002
  name: string; // Marketing/perfume name e.g. "Karus Gold Absolu", "Dunescape"
  brand: string; // Brand e.g. "Khadlaj", "Armaf", "Rasasi", "Afnan", "Lattafa"
  concentration: PerfumeConcentration;
  size_variant: string; // e.g. "100ML", "50ML", "200ML"
  category_id: string;
  category_name?: string;
  gender?: 'Men' | 'Women' | 'Unisex'; // Gender / Target audience
  photo_url?: string;
  perfume_type?: PerfumeType; // Middle Eastern | Western | Niche (unknown when unset)
  // Structured fragrance pyramid \u2014 arrays of human-readable note/accord names.
  // Leave unset when not reliably known; never fabricate.
  top_notes?: string[];
  heart_notes?: string[];
  base_notes?: string[];
  main_accords?: string[];
  // Warehouse-specific storage location (human-readable shelf/row, e.g. "A-03").
  // Absent/empty means the product has no assigned location in that warehouse.
  location_shop?: string; // Shop Floor
  location_main?: string; // Main / Back-store
  avg_cost: number; // in BDT (weighted average landed cost)
  // Gross weight of one complete unit INCLUDING bottle + box/package, in grams.
  // Metadata only \u2014 no weight-based shipping/calculation logic. Optional.
  // Absent (or 0) on existing products means "not set" and stays valid.
  gross_weight?: number;
  regular_price?: number; // alias used in pricing views (same as selling_price)
  selling_price: number; // in BDT
  wholesale_price?: number; // in BDT \u2014 masked/hidden by default (Point 1)
  // Product-level wholesale rule (Point: wholesale-pricing):
  //   'same_as_retail' \u2014 wholesale customer pays the current retail selling_price.
  //   'separate'       \u2014 wholesale customer pays the stored wholesale_price.
  // Absent/undefined on legacy rows:  derive as 'separate' only when a
  //   distinct wholesale_price exists, otherwise treat as 'same_as_retail'.
  wholesale_type?: 'same_as_retail' | 'separate';
  price_updated_at?: string; // timestamp of last selling_price change (Point 3.3)
  low_stock_threshold: number;
  batch_tracked?: boolean;
  is_bundle: boolean;
  bundle_components?: BundleComponent[];
  display_name: string; // Auto-derived: Brand + Name + Concentration + Size
  active: boolean;
  created_at: string;

  // Real-time stock aggregates attached when queried
  stock_on_hand?: number;
  stock_reserved?: number;
  stock_available?: number;
  stock_by_warehouse?: WarehouseStockLevel[];

  // Aliases for compatibility
  perfume_name?: string;
  available_stock?: number;
  stock_quantity?: number;
}

export type DamageSeverity = 'light' | 'medium' | 'heavy';
export type DamageSource = 'import' | 'return' | 'in_house';

// Section 21 / 41 + Point 2: batch/lot tracking per product.
// One product record may have many batches; each batch's quantity is tracked
// separately. Product's total stock is the sum across its sellable batches.
export interface ProductBatch {
  id: string;
  product_id: string;
  batch_code: string;
  manufacturer?: string;
  supplier_id?: string;
  supplier_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  location?: string;
  manufacturing_date?: string;
  import_date?: string;
  received_at?: string;
  maturation_days?: number;
  maturation_ready_date?: string;
  maturation_status?: 'READY' | 'MATURING';
  best_before_date?: string;
  expiry_date?: string;
  quantity_received: number;
  quantity_remaining: number;
  purchase_cost?: number;
  selling_price?: number;
  authenticity_status?: 'verified' | 'unverified' | 'questionable';
  evidence_urls?: string[];
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface OrderItemAllocation {
  batch_id: string;
  batch_code: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  warehouse_id?: string;
  location?: string;
  maturation_status?: 'READY' | 'MATURING';
  received_at?: string;
}

// Point 2.4: damaged stock record. Each damaged unit has a severity tier and a
// source ('import' vs 'return' vs 'in_house') so the two damage origins stay
// distinguishable in reports even though they share one underlying concept.
export interface DamagedStockRecord {
  id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  warehouse_id: string;
  quantity: number;
  severity: DamageSeverity; // light | medium | heavy
  source: DamageSource; // import | return | in_house
  batch_code?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  is_default_fulfillment?: boolean; // Shop Floor is default for online reservation
}

export interface InventoryRecord {
  product_id: string;
  warehouse_id: string;
  on_hand: number;
  reserved: number;
  avg_cost: number;
}

export type StockMovementReason =
  | 'PURCHASE'
  | 'PO_RECEIVING'
  | 'PURCHASE_RETURN'
  | 'SALE'
  | 'RETURN'
  | 'RETURN_RESTOCK'
  | 'DAMAGE'
  | 'DAMAGED_WRITE_OFF'
  | 'LOSS'
  | 'TRANSFER'
  | 'MARKETING_SAMPLE'
  | 'GIFT'
  | 'ADJUSTMENT'
  | 'OPENING_BALANCE'
  | 'TESTER_CONVERSION';

export interface StockMovement {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  warehouse_id: string;
  warehouse_name: string;
  quantity_delta: number; // Positive (+) for in, negative (-) for out
  movement_reason: StockMovementReason;
  unit_cost: number;
  total_cost: number;
  reference_id?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  notes?: string;
}

// Section 32.4 / 41: reservation ledger \u2014 separate from the stock movement
// ledger. A reservation (RESERVE/RELEASE) is not yet a physical movement.
export type ReservationEventType = 'RESERVE' | 'RELEASE';
export interface ReservationEvent {
  id: string;
  order_id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  type: ReservationEventType;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  notes?: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  address_text: string;
  is_primary?: boolean;
  is_default?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string; // Normalized: 01XXXXXXXXX
  customer_type?: 'retail' | 'wholesale';
  business_name?: string;
  order_count: number;
  total_spent: number;
  risk_flag: boolean; // Flagged if multiple RTOs / cancelled fraud orders
  rto_count?: number;
  cancelled_count?: number;
  completed_count?: number;
  addresses: CustomerAddress[];
  created_at: string;
  total_orders?: number; // alias for order_count
  rating?: number;
  city?: string;
}

export type OrderType = 'direct_sale' | 'merchant_fulfillment';
export type OrderChannel = 'messenger' | 'walk-in';
export type FulfillmentMethod = 'steadfast' | 'instant_delivery' | 'in_house' | 'self_pickup' | 'n_a_walk_in';
export type InstantDeliveryProvider = 'pathao' | 'uber' | 'other';
export type OrderTiming = 'today' | 'scheduled' | 'pre_order';
export type OrderStatus =
  | 'confirmed'
  | 'packed'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'rto';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  barcode: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
  unit_cost_at_sale: number; // Historical snapshot
  perfume_type?: 'Middle Eastern' | 'Niche' | 'Western';
  allocations?: OrderItemAllocation[];
  batch_code?: string;
  batch_id?: string;
}

export interface OrderTesterItem {
  id: string;
  product_id: string;
  product_name: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  notes?: string;
}

export interface PaymentTransaction {
  id: string;
  order_id: string;
  amount: number;
  method: 'cash' | 'bkash' | 'nagad' | 'bank' | 'card' | 'cod_pending';
  transaction_ref?: string;
  payment_account_id: string;
  received_by: string;
  status: 'completed' | 'pending' | 'refunded';
  payment_date?: string;
  notes?: string;
  account_name?: string;
  created_at: string;
}

export interface Order {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  channel: OrderChannel;
  order_type?: OrderType; // 'direct_sale' (default) | 'merchant_fulfillment'
  merchant_name?: string; // Merchant / Company Name (dropship)
  merchant_id?: string; // Merchant ID
  parcel_id?: string; // Parcel ID
  end_customer_name?: string; // End Customer Name
  sale_type?: 'retail' | 'wholesale'; // wholesale sale from walk-in POS (Point 4)
  order_timing?: OrderTiming; // 'today' (default) | 'scheduled' | 'pre_order'
  scheduled_date?: string; // YYYY-MM-DD for scheduled orders
  moved_to_today_at?: string; // ISO timestamp when pre-order was approved/moved to Today's Orders
  timing_reason?: string; // Reason or detection note
  fulfillment_method: FulfillmentMethod;
  instant_delivery_provider?: InstantDeliveryProvider;
  delivery_address_id?: string;
  delivery_address_text?: string;
  rider_delivery_charge?: number;
  delivered_by_user_id?: string;
  delivered_by_name?: string;
  status: OrderStatus;
  source_text?: string; // Raw pasted messenger text for audit
  cancelled_at?: string;
  cancelled_by?: string;
  cancelled_by_name?: string;
  cancelled_from_status?: OrderStatus;
  refunded_amount?: number;
  physical_recovery_required?: boolean;
  items: OrderItem[];
  subtotal: number;
  delivery_charge: number;
  discount_amount: number;
  total: number;
  cancel_reason?: string;
  notes?: string;
  invoice_note?: string;
  invoice_note_type?: 'cod' | 'prepaid' | 'none';
  business_date?: string; // YYYY-MM-DD business day for cashier daily closing
  closing_id?: string;
  order_barcode: string; // Code128 string
  payments: PaymentTransaction[];
  paid_amount?: number;
  due_amount?: number;
  courier_cod_amount?: number;
  packed_by?: string;
  packed_by_name?: string;
  packed_at?: string;
  dispatched_by?: string;
  dispatched_by_name?: string;
  dispatched_at?: string;
  courier_tracking_code?: string;
  // Steadfast booking \u2192 label \u2192 verify \u2192 dispatch workflow state (Section 9/11)
  courier_consignment_id?: string;
  courier_booked?: boolean;
  courier_booking_at?: string;
  courier_estimated_charge?: number;
  actual_courier_charge?: number | null;
  courier_charge_source?: CourierChargeSource;
  label_printed?: boolean;
  label_printed_at?: string;
  tracking_verified?: boolean;
  tracking_verified_at?: string;
  tracking_verified_by?: string;
  package_weight_grams?: number;
  package_box_size?: string;
  qa_notes?: string;
  verified_items_count?: number;
  packing_note?: string;
  packing_note_by_id?: string;
  packing_note_by_name?: string;
  packing_note_at?: string;
  testers?: OrderTesterItem[];
  accounts_note?: string;
  accounts_note_by_id?: string;
  accounts_note_by_name?: string;
  accounts_note_at?: string;
  transaction_date?: string;
  entry_timestamp?: string;
  delivery_date?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export type PaymentAccountType = 'cash' | 'petty_cash' | 'bank' | 'bkash' | 'nagad' | 'rocket' | 'upay' | 'other';

export interface PaymentAccount {
  id: string;
  account_name: string;
  account_type: PaymentAccountType;
  account_number: string;
  bank_name?: string;
  branch_name?: string;
  routing_number?: string;
  linked_chart_account_id: string;
  linked_chart_account_code?: string;
  linked_chart_account_name?: string;
  is_default_pos?: boolean;
  is_default_courier_settlement?: boolean;
  is_default_payroll?: boolean;
  is_default_expense?: boolean;
  is_active: boolean;
  opening_balance: number;
  current_balance: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FundTransferRecord {
  id: string;
  transfer_number: string;
  from_account_id: string;
  from_account_name: string;
  to_account_id: string;
  to_account_name: string;
  amount: number;
  transfer_date: string;
  fee_amount?: number;
  fee_account_id?: string;
  reference?: string;
  notes?: string;
  journal_entry_id?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface AccountDepositRecord {
  id: string;
  deposit_number: string;
  payment_account_id: string;
  payment_account_name: string;
  amount: number;
  deposit_date: string;
  source_type: 'capital_injection' | 'bank_interest' | 'cash_deposit' | 'customer_advance' | 'other_income';
  offset_account_id: string;
  offset_account_name: string;
  reference?: string;
  notes?: string;
  journal_entry_id?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface AccountWithdrawalRecord {
  id: string;
  withdrawal_number: string;
  payment_account_id: string;
  payment_account_name: string;
  amount: number;
  withdrawal_date: string;
  reason_type: 'owner_drawings' | 'bank_charge' | 'external_withdrawal' | 'other_expense';
  offset_account_id: string;
  offset_account_name: string;
  reference?: string;
  notes?: string;
  journal_entry_id?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface ManualAdjustmentRecord {
  id: string;
  adjustment_number: string;
  payment_account_id: string;
  payment_account_name: string;
  direction: 'money_in' | 'money_out';
  amount: number;
  offset_account_id: string;
  offset_account_name: string;
  adjustment_date: string;
  reason_category:
    | 'unrecorded_pos_collection'
    | 'unrecorded_expense'
    | 'gateway_sync_correction'
    | 'bank_charge_adjustment'
    | 'cash_shortage_correction'
    | 'cash_overage_correction'
    | 'opening_balance_correction'
    | 'historical_audit_correction'
    | 'other_correction';
  reason_notes: string;
  reference?: string;
  journal_entry_id: string;
  created_by: string;
  created_by_name: string;
  status: 'posted' | 'voided';
  void_reason?: string;
  void_journal_entry_id?: string;
  voided_by?: string;
  voided_by_name?: string;
  voided_at?: string;
  created_at: string;
}

export type JournalTransactionType =
  | 'pos_sale'
  | 'expense'
  | 'payroll'
  | 'fund_transfer_in'
  | 'fund_transfer_out'
  | 'deposit'
  | 'withdrawal'
  | 'manual_adjustment'
  | 'supplier_payment'
  | 'customer_return'
  | 'courier_settlement'
  | 'cashier_closing'
  | 'general_journal';

export interface PaymentAccountStatementItem {
  id: string;
  date: string;
  reference: string;
  entry_number: string;
  journal_entry_id: string;
  transaction_type: JournalTransactionType;
  description: string;
  money_in: number;
  money_out: number;
  running_balance: number;
  related_entity_type?: string;
  related_entity_id?: string;
  created_by_name: string;
}

export interface FinancialTransactionFeedItem {
  id: string;
  date: string;
  reference: string;
  entry_number: string;
  journal_entry_id: string;
  transaction_type: JournalTransactionType;
  description: string;
  money_in: number;
  money_out: number;
  running_balance: number;
  payment_account_id: string;
  payment_account_name: string;
  payment_account_type?: string;
  created_by_name: string;
  created_at?: string;
  order_id?: string;
  order_number?: string;
  invoice_number?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  order_total?: number;
  paid_amount?: number;
  due_amount?: number;
  previous_customer_due?: number;
  payment_method?: string;
  order_status?: string;
}

export type AccountType = 'asset' | 'liability' | 'income' | 'expense' | 'equity' | 'revenue';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  balance: number;
}

export interface JournalLine {
  account_id: string;
  account_code?: string;
  account_name: string;
  debit: number;
  credit: number;
  line_desc?: string;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  date: string;
  description: string;
  reference_id?: string;
  transaction_type?: JournalTransactionType;
  lines: JournalLine[];
  total_debit: number;
  total_credit: number;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: any;
  old_state?: any;
  new_state?: any;
  hash?: string;
  created_at: string;
}

export type ApprovalRequestType =
  | 'price_discount_override'
  | 'order_cancellation'
  | 'damaged_writeoff'
  | 'high_expense'
  | 'manual_journal';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  request_number: string;
  request_type: ApprovalRequestType;
  title: string;
  description: string;
  impact_amount: number;
  requested_by_id: string;
  requested_by_name: string;
  requested_at: string;
  status: ApprovalStatus;
  reviewed_by_id?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
  payload_data?: any;
}

export interface CompanySettings {
  company_name?: string;
  business_name: string;
  phone: string;
  address: string;
  delivery_fee_inside_dhaka?: number;
  delivery_fee_outside_dhaka?: number;
  inside_dhaka_delivery?: number; // default 70
  outside_dhaka_delivery?: number; // default 120
  rto_risk_threshold?: number; // default 2
  invoice_note_cod?: string; // Default COD invoice note template
  invoice_note_prepaid?: string; // Default Prepaid invoice note template
  // How long a recently-changed selling price row stays highlighted, in hours.
  // Controls the Products-table row tint (Point 3.3). Default 48 (2 days).
  price_highlight_duration_hours?: number;
  gemini_api_key?: string;
  courier_api_key?: string;
  courier_secret_key?: string;
  courier_base_url?: string;
  steadfast_api_key?: string;
  steadfast_secret_key?: string;
}

export type ThemePreset = 'light' | 'dark' | 'system';

export type CourierBookingStatus = 'booked' | 'in_transit' | 'delivered' | 'cancelled' | 'rto';

export type CourierChargeSource = 'steadfast_api' | 'manual';

export interface CourierChargeAuditEntry {
  id: string;
  timestamp: string;
  source: CourierChargeSource;
  previous_charge?: number | null;
  new_charge: number;
  actor_id?: string;
  actor_name?: string;
  notes?: string;
}

export interface CourierApiConflict {
  api_charge: number;
  manual_charge?: number;
  detected_at?: string;
  fetched_at?: string;
  note?: string;
}

export interface CourierBooking {
  id: string;
  order_id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  booking_id: string;
  consignment_no: string;
  status: CourierBookingStatus;
  cod_amount: number;
  delivery_charge: number; // What the customer was charged (Section 3.1 & 41)
  estimated_charge?: number; // System-calculated/booking estimate only (NEVER treated as confirmed actual)
  actual_charge?: number | null; // Confirmed actual charge from Steadfast API or manual staff entry only. Null/empty if pending.
  variance?: number | null; // delivery_charge - actual_charge (null if actual_charge is pending)
  courier_charge_source?: CourierChargeSource;
  charge_entered_by_id?: string;
  charge_entered_by_name?: string;
  charge_entered_at?: string;
  charge_synced_at?: string;
  charge_history?: CourierChargeAuditEntry[];
  pending_api_conflict?: CourierApiConflict | null;
  customer_delivery_charge?: number;
  actual_courier_cost?: number | null;
  package_weight_grams?: number;
  destination_zone?: 'inside_dhaka' | 'outside_dhaka' | 'sub_dhaka';
  delivery_zone?: 'inside_dhaka' | 'outside_dhaka' | 'sub_dhaka';
  booked_at: string;
  delivered_at?: string;
  created_at?: string;
  updated_at?: string;
  payout_status?: 'pending' | 'reconciled' | 'discrepancy';
  payout_amount?: number;
  settlement_batch_id?: string;
  settled_at?: string;
  actual_cod_collected?: number;
  notes?: string;
}

export interface SettlementBatchItem {
  booking_id: string;
  order_id: string;
  invoice_number: string;
  consignment_no: string;
  customer_name: string;
  customer_phone?: string;
  status: CourierBookingStatus;
  expected_cod: number;
  actual_cod_collected: number;
  customer_delivery_charge: number;
  actual_courier_charge: number;
  variance: number; // customer_delivery_charge - actual_courier_charge
  net_payout: number; // actual_cod_collected - actual_courier_charge
  is_rto?: boolean;
  notes?: string;
}

export interface CourierSettlementBatch {
  id: string;
  batch_number: string; // e.g. "ST-BATCH-2026-0001"
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
  carrier: 'steadfast' | 'other';
  status: 'draft' | 'posted';
  total_orders: number;
  total_delivered_orders: number;
  total_rto_orders: number;
  total_expected_cod: number;
  total_cod_collected: number;
  total_customer_delivery_charge: number;
  total_actual_courier_charges: number;
  net_calculated_payout: number; // total_cod_collected - total_actual_courier_charges
  actual_bank_payout: number; // what was actually received in the bank/bKash deposit
  discrepancy_amount: number; // actual_bank_payout - net_calculated_payout (negative = shortage, positive = surplus)
  deposit_account_id: string; // 'acc_bank', 'acc_bkash', etc.
  deposit_account_name?: string;
  deposit_reference?: string; // bank txn ref / statement ID
  discrepancy_notes?: string;
  notes?: string;
  items: SettlementBatchItem[];
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  updated_at?: string;
  posted_at?: string;
  posted_by_id?: string;
  posted_by_name?: string;
  journal_entry_id?: string;
}

export interface ReconciliationSummary {
  total_courier_orders: number;
  total_cod_expected: number;
  total_cod_collected: number;
  total_customer_delivery_charged: number;
  total_actual_courier_charges: number;
  net_delivery_variance: number; // total charged - total actual (positive = profit, negative = deficit)
  reconciled_count: number;
  pending_count: number;
  discrepancy_count: number;
  pending_actual_charge_count?: number;
}

export interface NotificationItem {
  id: string;
  type: 'new_order' | 'low_stock' | 'system' | 'rto_alert' | 'approval_request' | 'cash_shortage' | 'carrier_exception' | 'price_changed' | 'alert' | 'crm_task_due' | 'crm_followup' | 'crm_lead' | 'crm_ticket';
  priority?: 'info' | 'warning' | 'critical';
  title?: string;
  message: string;
  ref_type?: string;
  ref_id?: string;
  action_url?: string;
  read: boolean;
  created_at: string;
}

export type CurrencyCode = 'AED' | 'USD' | 'BDT' | 'EUR';

export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  country: string; // 'UAE' | 'Bangladesh' | 'France' | 'Other'
  currency: CurrencyCode;
  default_exchange_rate: number; // e.g. 33.0 for AED, 122.0 for USD
  balance_payable: number; // In BDT
  payment_terms: string; // 'Advance' | 'Net 30' | '50% Advance, 50% on BL' | 'COD'
  tax_id_or_trade_license?: string;
  notes?: string;
  active: boolean;
  total_purchases_count?: number;
  total_purchases_amount_bdt?: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierPayment {
  id: string;
  payment_number: string;
  supplier_id: string;
  supplier_name: string;
  amount_bdt: number;
  amount_foreign?: number;
  currency: CurrencyCode;
  exchange_rate: number;
  payment_account_id: string;
  payment_account_name: string;
  payment_date: string;
  reference_no: string;
  notes?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  barcode: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost_foreign: number;
  currency: CurrencyCode;
  exchange_rate: number;
  unit_cost_bdt: number;
  landed_freight_per_unit: number;
  landed_duty_per_unit: number;
  total_landed_unit_cost_bdt: number;
  total_amount_bdt: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  order_date: string;
  expected_delivery_date?: string;
  target_warehouse_id: string;
  target_warehouse_name: string;
  currency: CurrencyCode;
  exchange_rate: number;
  items: PurchaseOrderItem[];
  subtotal_bdt: number;
  freight_total_bdt: number;
  customs_duty_total_bdt: number;
  other_costs_bdt: number;
  total_amount_bdt: number;
  status: PurchaseOrderStatus;
  payment_status: 'unpaid' | 'partially_paid' | 'paid';
  amount_paid_bdt: number;
  notes?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export type PurchaseReturnReason =
  | 'damaged_in_transit'
  | 'wrong_item'
  | 'wrong_sku'
  | 'quality_defect'
  | 'expired_batch'
  | 'expired_or_near_expiry'
  | 'other';

export interface PurchaseReturnItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  barcode?: string;
  quantity: number;
  unit_cost_bdt: number;
  total_amount_bdt: number;
}

export interface PurchaseReturn {
  id: string;
  return_number: string;
  supplier_id: string;
  supplier_name: string;
  purchase_order_id?: string;
  purchase_order_number?: string;
  warehouse_id: string;
  warehouse_name: string;
  return_date: string;
  reason: PurchaseReturnReason;
  reason_details?: string;
  items: PurchaseReturnItem[];
  total_amount_bdt: number;
  settlement_type: 'credit_note' | 'cash_refund' | 'bank_refund';
  refund_account_id?: string;
  refund_account_name?: string;
  status: 'completed' | 'pending';
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface CourierWebhookLog {
  id: string;
  courier: 'steadfast' | 'redx' | 'pathao';
  event_type: string;
  consignment_no: string;
  tracking_code?: string;
  invoice_number?: string;
  courier_status: string;
  mapped_order_status: OrderStatus;
  raw_payload: string;
  processing_status: 'success' | 'ignored' | 'error';
  processing_notes?: string;
  received_at: string;
}

export interface CourierApiConfig {
  provider: 'steadfast';
  api_key: string;
  secret_key: string;
  base_url: string;
  webhook_secret: string;
  is_live: boolean;
  webhook_enabled: boolean;
  auto_sync_enabled: boolean;
  auto_sync_interval_minutes: number;
  last_sync_at?: string;
  status: 'connected' | 'unconfigured' | 'error';
}

export type ItemReturnCondition = 'restockable' | 'damaged_tester' | 'damaged_writeoff';
export type CustomerReturnType = 'courier_rto' | 'customer_return';
export type CustomerReturnReason =
  | 'refused_at_doorstep'
  | 'wrong_address'
  | 'damaged_bottle'
  | 'wrong_item_sent'
  | 'customer_remorse'
  | 'fragrance_dislike'
  | 'other';

export interface CustomerReturnItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  barcode: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  condition: ItemReturnCondition;
  restock_warehouse_id: string;
  restock_warehouse_name: string;
}

export interface CustomerReturn {
  id: string;
  return_number: string;
  order_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  return_type: CustomerReturnType;
  reason: CustomerReturnReason;
  reason_details?: string;
  items: CustomerReturnItem[];
  total_items_count: number;
  refund_amount: number;
  courier_fee_loss: number;
  courier_fee_estimated?: number;
  courier_fee_actual?: number | null;
  courier_fee_source?: CourierChargeSource;
  courier_fee_entered_by?: string;
  courier_fee_entered_at?: string;
  courier_fee_synced_at?: string;
  courier_fee_history?: CourierChargeAuditEntry[];
  pending_return_fee_conflict?: CourierApiConflict | null;
  refund_method: 'bank_transfer' | 'bkash' | 'nagad' | 'cash' | 'store_credit' | 'none_rto';
  refund_account_id?: string;
  refund_account_name?: string;
  status: 'received' | 'inspected' | 'refunded' | 'closed';
  inspected_by: string;
  inspected_by_name: string;
  inspected_at: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

// --- PHASE 6: ACCOUNTING, CASH RECONCILIATION, EXPENSES & PAYROLL TYPES ---

export interface DailyCashRegisterLog {
  id: string;
  session_date: string;
  opening_float: number;
  cash_sales_inflow: number;
  cash_outflow: number;
  expected_closing_cash: number;
  actual_cash_count: number;
  variance: number;
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
  closed_by: string;
  closed_by_name: string;
  created_at: string;
}

export type CashierClosingStatus = 'open' | 'submitted' | 'approved' | 'rejected';

export interface CashierCashExpense {
  id: string;
  expense_record_id?: string;
  expense_number?: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  receipt_reference?: string;
  created_at: string;
}

export interface CashierClosingSalesMetrics {
  total_sales: number;
  order_count: number;
  cash_sales: number;
  bkash_sales: number;
  nagad_sales: number;
  bank_sales: number;
  card_sales: number;
  total_collected: number;
}

export interface CashierDailyClosing {
  id: string;
  cashier_id: string;
  cashier_name: string;
  business_date: string; // YYYY-MM-DD
  status: CashierClosingStatus;
  started_at: string;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewed_by_name?: string;
  review_notes?: string;
  opening_float: number;
  sales_metrics: CashierClosingSalesMetrics;
  cash_expenses: CashierCashExpense[];
  total_cash_expenses: number;
  expected_cash: number;
  actual_cash: number;
  cash_variance: number;
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
  journal_entry_id?: string;
  created_at: string;
  updated_at: string;
}

export type ExpenseCategory =
  | 'rent'
  | 'utility'
  | 'marketing'
  | 'packing_supplies'
  | 'office_tea_snacks'
  | 'courier_charges'
  | 'customs_duty'
  | 'other'
  | string;

export type ExpenseType = 'daily' | 'recurring' | 'supplies' | 'other';

export interface ExpenseCategoryDefinition {
  id: string;
  name: string;
  type: ExpenseType;
  expense_account_id: string;
  expense_account_name?: string;
  subcategories: string[];
  is_system?: boolean;
  active: boolean;
  created_at: string;
}

export interface ExpenseTemplate {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  subcategory?: string;
  expense_type: ExpenseType;
  default_amount?: number;
  default_payment_account_id: string;
  default_payment_account_name?: string;
  default_payment_method: 'cash' | 'bank' | 'bkash' | 'nagad';
  default_description: string;
  is_frequent: boolean;
  is_recurring?: boolean;
  recurring_day?: number;
  recurring_frequency?: 'monthly' | 'daily' | 'weekly';
  last_recorded_date?: string;
  last_recorded_expense_id?: string;
  created_by: string;
  created_at: string;
}

export interface ExpenseBudget {
  id: string;
  category_id: string;
  category_name: string;
  subcategory?: string; // Optional specific subcategory or all
  period: 'daily' | 'monthly';
  amount: number;
  warning_threshold_percent: number; // e.g. 80
  created_by: string;
  created_at: string;
  updated_at?: string;
  // Computed runtime properties
  spent?: number;
  remaining?: number;
  used_percentage?: number;
  status?: 'ok' | 'near_budget' | 'exceeded';
  overspent?: number;
}

export interface ExpenseRecord {
  id: string;
  expense_number: string;
  category: ExpenseCategory;
  category_id?: string;
  category_name?: string;
  subcategory?: string;
  expense_type?: ExpenseType;
  description: string;
  amount: number;
  expense_account_id: string;
  expense_account_name: string;
  payment_account_id: string;
  payment_account_name: string;
  payment_method: 'cash' | 'bank' | 'bkash' | 'nagad';
  receipt_reference?: string;
  receipt_url?: string;
  vendor_recipient?: string;
  template_id?: string;
  journal_entry_id?: string;
  reversal_journal_entry_id?: string;
  status?: 'recorded' | 'pending_approval' | 'voided';
  voided_at?: string;
  voided_by?: string;
  void_reason?: string;
  date: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface ExpensePaginationResult {
  items: ExpenseRecord[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  summary: {
    total_amount: number;
    today_amount: number;
    this_month_amount: number;
    filtered_amount: number;
  };
}

export interface EmployeeDocument {
  id: string;
  title: string;
  doc_type: 'nid_passport' | 'contract' | 'certificate' | 'experience' | 'warning' | 'resignation' | 'other';
  file_name: string;
  file_url?: string;
  uploaded_at: string;
  expiry_date?: string;
}

export interface EmployeeSalaryStructure {
  basic: number;
  house_rent: number;
  medical: number;
  conveyance: number;
  other_allowance: number;
  tax_deduction: number;
  provident_fund: number;
  other_deductions: number;
}

export interface Employee {
  id: string;
  user_id?: string;
  employee_id_code?: string;
  name: string;
  phone: string;
  email?: string;
  photo_url?: string;
  designation: string;
  designation_id?: string;
  role: string;
  department_id?: string;
  department_name?: string;
  branch_id?: string;
  branch_name?: string;
  reporting_manager_id?: string;
  reporting_manager_name?: string;
  employment_type?: 'full_time' | 'part_time' | 'contractual' | 'intern' | 'probation';
  employment_status?: 'active' | 'on_leave' | 'suspended' | 'resigned' | 'terminated';
  base_salary: number;
  disbursement_method: 'bank' | 'bkash' | 'cash';
  bank_account_no?: string;
  bank_name?: string;
  bank_routing_no?: string;
  bkash_number?: string;
  joined_date: string;
  probation_end_date?: string;
  contract_end_date?: string;
  address?: string;
  emergency_contact?: {
    name: string;
    relation: string;
    phone: string;
  };
  nid_passport?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  marital_status?: 'single' | 'married' | 'other';
  shift_id?: string;
  shift_name?: string;
  salary_structure?: EmployeeSalaryStructure;
  leave_balances?: Record<string, number>;
  active_loan_balance?: number;
  documents?: EmployeeDocument[];
  active: boolean;
}

export interface PayrollRecord {
  id: string;
  payslip_number: string;
  payroll_month: string; // e.g. "2026-02"
  employee_id: string;
  employee_name: string;
  designation: string;
  department_name?: string;
  base_salary: number;
  house_rent?: number;
  medical_allowance?: number;
  conveyance?: number;
  other_allowances?: number;
  gross_salary?: number;
  bonus_commission: number;
  deductions: number;
  tax_deduction?: number;
  pf_deduction?: number;
  advance_deduction?: number;
  absence_deduction?: number;
  net_payable: number;
  payment_account_id: string;
  payment_account_name: string;
  payment_date: string;
  status: 'paid' | 'pending';
  working_days?: number;
  present_days?: number;
  paid_leave_days?: number;
  unpaid_leave_days?: number;
  is_manual_override?: boolean;
  override_reason?: string;
  override_by?: string;
  journal_entry_id?: string;
  transaction_reference?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

// --- HR Management Entities ---

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  parent_department_id?: string;
  parent_department_name?: string;
  head_employee_id?: string;
  head_employee_name?: string;
  active: boolean;
  created_at?: string;
}

export interface Designation {
  id: string;
  title: string;
  department_id?: string;
  department_name?: string;
  description?: string;
  active: boolean;
  created_at?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone?: string;
  is_headquarters?: boolean;
  active: boolean;
  created_at?: string;
}

export interface Shift {
  id: string;
  name: string;
  start_time: string; // "10:00"
  end_time: string; // "19:00"
  late_grace_minutes: number; // e.g. 15
  half_day_threshold_minutes: number; // e.g. 240
  active: boolean;
  created_at?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // "YYYY-MM-DD"
  type: 'national' | 'religious' | 'company';
  description?: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string; // "YYYY-MM-DD"
  check_in?: string; // "HH:mm"
  check_out?: string; // "HH:mm"
  status: 'present' | 'late' | 'half_day' | 'absent' | 'on_leave';
  shift_id?: string;
  shift_name?: string;
  is_manual: boolean;
  correction_reason?: string;
  punch_in_method: 'biometric' | 'web' | 'mobile' | 'manual';
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface AttendanceRegularization {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  proposed_check_in: string;
  proposed_check_out: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  days_allowed_per_year: number;
  is_paid: boolean;
  accrual_frequency: 'yearly' | 'monthly';
  can_carry_forward: boolean;
  max_carry_forward_days?: number;
  color: string;
  active: boolean;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'pending_manager' | 'pending_hr' | 'approved' | 'rejected' | 'cancelled';
  manager_approval_by?: string;
  manager_approval_at?: string;
  manager_notes?: string;
  hr_approval_by?: string;
  hr_approval_at?: string;
  hr_notes?: string;
  created_at: string;
}

export interface LeaveAdjustment {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  leave_type_name: string;
  adjustment_days: number; // positive to add, negative to deduct
  reason: string;
  adjusted_by: string;
  adjusted_by_name: string;
  created_at: string;
}

export interface SalaryAdvance {
  id: string;
  advance_number: string;
  employee_id: string;
  employee_name: string;
  amount: number;
  disbursed_amount: number;
  remaining_balance: number;
  monthly_installment: number;
  repayment_months: number;
  deducted_so_far: number;
  reason: string;
  status: 'requested' | 'approved' | 'disbursed' | 'closed' | 'rejected';
  disbursement_account_id?: string;
  disbursement_account_name?: string;
  disbursement_date?: string;
  journal_entry_id?: string;
  created_by: string;
  created_at: string;
}

export interface PayrollPeriodRun {
  id: string;
  payroll_month: string; // e.g. "2026-02"
  total_employees: number;
  total_gross_salary: number;
  total_allowances: number;
  total_deductions: number;
  total_net_payable: number;
  status: 'draft' | 'approved' | 'finalized';
  journal_entry_id?: string;
  payment_account_id?: string;
  payment_account_name?: string;
  slips: PayrollRecord[];
  created_by: string;
  created_at: string;
  finalized_at?: string;
}

export interface JobRequisition {
  id: string;
  title: string;
  department_id: string;
  department_name: string;
  openings: number;
  employment_type: string;
  experience_required?: string;
  salary_range?: string;
  description?: string;
  status: 'draft' | 'open' | 'closed' | 'on_hold';
  created_at: string;
}

export interface JobCandidate {
  id: string;
  job_requisition_id: string;
  job_title: string;
  name: string;
  email: string;
  phone: string;
  current_stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
  interview_date?: string;
  rating?: number;
  notes?: string;
  resume_url?: string;
  hired_employee_id?: string;
  applied_at: string;
}

export interface EmployeeGoal {
  id: string;
  employee_id: string;
  employee_name: string;
  title: string;
  description?: string;
  target_date: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
  progress_percentage: number;
  created_at: string;
}

export interface PerformanceReview {
  id: string;
  employee_id: string;
  employee_name: string;
  cycle: string; // e.g. "2026-Q1"
  reviewer_id: string;
  reviewer_name: string;
  rating: number; // 1 to 5
  strengths: string;
  areas_for_improvement: string;
  feedback: string;
  status: 'draft' | 'submitted' | 'acknowledged';
  created_at: string;
}

export interface EmployeeExitRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  exit_type: 'resignation' | 'termination' | 'contract_end' | 'retirement';
  notice_date: string;
  last_working_date: string;
  reason: string;
  status: 'initiated' | 'clearance_in_progress' | 'settled' | 'cancelled';
  clearance_items: { item: string; cleared: boolean; notes?: string; cleared_by?: string }[];
  settlement: {
    unpaid_salary: number;
    leave_encashment_days: number;
    leave_encashment_amount: number;
    loan_deductions: number;
    other_adjustments: number;
    net_settlement_amount: number;
    payment_account_id?: string;
    payment_account_name?: string;
    journal_entry_id?: string;
    settled_at?: string;
  };
  created_by: string;
  created_at: string;
}

export interface HRNotification {
  id: string;
  type: 'birthday' | 'anniversary' | 'expiry' | 'pending_approval' | 'payroll_reminder';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'alert';
  date: string;
  read: boolean;
  ref_type?: string;
  ref_id?: string;
}

export interface HRDashboardSummary {
  total_employees: number;
  active_employees: number;
  on_leave_today: number;
  present_today: number;
  attendance_rate_percent: number;
  pending_leaves_count: number;
  pending_regularizations_count: number;
  pending_advances_count: number;
  expiring_documents_count: number;
  upcoming_birthdays_count: number;
  monthly_payroll_estimate: number;
}

export interface ProfitLossReport {
  period: string;
  revenue: {
    product_sales: number;
    delivery_income: number;
    sales_returns: number;
    net_revenue: number;
  };
  cogs: number;
  gross_profit: number;
  gross_margin_percent: number;
  operating_expenses: {
    rent: number;
    salaries: number;
    courier_freight_rto: number;
    showroom_testers: number;
    damaged_stock_loss: number;
    utilities_office: number;
    marketing_ads: number;
    packing_supplies: number;
    cash_shortage: number;
    other: number;
    total_operating_expenses: number;
  };
  net_operating_profit: number;
  net_margin_percent: number;
}

export interface BalanceSheetReport {
  as_of_date: string;
  assets: {
    cash_in_hand: number;
    bank_deposits: number;
    mfs_wallets: number;
    courier_receivable: number;
    inventory_valuation: number;
    total_assets: number;
  };
  liabilities: {
    supplier_payables: number;
    accrued_expenses: number;
    total_liabilities: number;
  };
  equity: {
    owner_capital: number;
    current_retained_earnings: number;
    total_equity: number;
  };
  is_balanced: boolean;
}

// --- Phase 9: Dynamic Pricing & Competitor Tracking (Section 22, 40.9) ---

export interface CompetitorPriceRecord {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  competitor_name: string; // "Sundora", "Perfume BD", "Bangla Shoppers", "Scentsation", "Buy Perfume in BD"
  competitor_price: number;
  competitor_url?: string;
  in_stock: boolean;
  notes?: string;
  recorded_at: string;
}

export interface PricingRule {
  id: string;
  name: string;
  strategy: 'cost_plus' | 'competitor_undercut' | 'market_match' | 'premium_niche';
  minimum_margin_percent: number; // default 20%
  target_margin_percent: number; // default 35%
  max_discount_percent: number; // default 15%
  undercut_amount: number; // e.g. 50 or 100 BDT
  active: boolean;
}

export interface PricingCampaign {
  id: string;
  name: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_date: string;
  end_date: string;
  target_type: 'all' | 'category' | 'brand' | 'sku';
  target_value?: string;
  active: boolean;
}

export interface RepricingSuggestion {
  product_id: string;
  product_name: string;
  sku: string;
  category_name?: string;
  current_price: number;
  cost_price: number;
  floor_price: number;
  lowest_competitor_price?: number;
  lowest_competitor_name?: string;
  average_market_price?: number;
  suggested_price: number;
  projected_margin_percent: number;
  price_difference_vs_current: number;
  recommendation_reason: string;
  status: 'optimal' | 'undervalued' | 'overpriced' | 'below_floor';
}

// --- Phase 10: System Hardening, 2FA & Backups (Section 31, 40.10) ---

export interface SecuritySettings {
  session_timeout_minutes: number; // e.g. 15, 30, 60, 480
  max_failed_logins: number; // e.g. 5
  require_2fa_admin: boolean; // Enforce 2FA for Tier 1 & Tier 2
  backup_frequency: 'hourly' | 'daily' | 'weekly';
  ip_allowlist?: string[];
  audit_chain_strict: boolean;
}

export interface BackupSnapshot {
  id: string;
  filename: string;
  timestamp: string;
  version: string;
  size_kb: number;
  record_counts: {
    products: number;
    orders: number;
    customers: number;
    inventory_ledger: number;
    journal_entries: number;
    expenses: number;
    payroll: number;
    audit_logs: number;
  };
  checksum: string;
  created_by: string;
  status: 'completed' | 'corrupted';
}

export interface SystemHealthStatus {
  server_status: 'healthy' | 'warning' | 'degraded';
  uptime_seconds: number;
  memory_usage_mb: number;
  total_database_records: number;
  audit_chain_verified: boolean;
  active_sessions_count: number;
  last_backup_at?: string;
  environment: string;
}

// --- Operations: Packaging Materials (Section 42 \u2014 separate from perfume Inventory) ---

export type PackagingCategory = 'carton' | 'poly' | 'wrapping' | 'tape' | 'cutting_tool' | 'gift' | 'label' | 'other';

export type PackagingStockMovementReason =
  | 'PURCHASE'
  | 'PACKAGING_USED'
  | 'DAMAGE'
  | 'LOSS'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'OPENING_BALANCE';

export type PackagingStockStatus = 'healthy' | 'low_stock' | 'critical' | 'out_of_stock';

export interface PackagingMaterial {
  id: string;
  name: string;            // e.g. "Medium Carton", "Poly M"
  barcode: string;         // e.g. "CTN-M", "POLY-M"
  sku: string;             // internal code
  category: PackagingCategory;
  unit: string;            // e.g. "piece", "roll", "pack"
  on_hand: number;
  reserved: number;
  available: number;       // computed: on_hand - reserved
  reorder_level: number;   // warning threshold
  unit_cost: number;       // last known cost in BDT
  photo_url?: string;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PackagingStockMovement {
  id: string;
  material_id: string;
  material_name: string;
  barcode: string;
  quantity_delta: number;  // positive = in, negative = out
  reason: PackagingStockMovementReason;
  unit_cost: number;
  reference_id?: string;   // e.g. order_id for PACKAGING_USED
  reference_note?: string; // e.g. "Packed order INV-2026-1042"
  created_by: string;
  created_by_name: string;
  created_at: string;
  notes?: string;
}

// Per-order packaging configuration: which materials are required for each order
export interface OrderPackagingRequirement {
  material_id: string;
  material_name: string;
  barcode: string;
  category: PackagingCategory;
  quantity: number;        // how many of this material are needed
  discrete: boolean;       // true = must be scanned per order (carton, poly, sticker)
                            // false = general-use consumable (bubble wrap, tape)
}

// Tracks which packaging materials have been scanned/verified for a specific order
export interface OrderPackagingVerification {
  material_id: string;
  material_name: string;
  barcode: string;
  required_qty: number;
  scanned_qty: number;
  verified: boolean;       // scanned_qty >= required_qty
}

export type PackagingMovementPageFilter = 'all' | 'purchase' | 'used' | 'damaged' | 'lost' | 'adjustment';

// ============================================================================
// PHASE: CRM & RELATIONSHIP MANAGEMENT TYPES
// Strictly enriches existing Customer, Order, Product, and Accounting entities
// ============================================================================

export type LeadSource =
  | 'messenger'
  | 'walk-in'
  | 'referral'
  | 'advertisement'
  | 'existing_customer'
  | 'other';

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiating'
  | 'won'
  | 'lost';

export interface Lead {
  id: string;
  customer_id?: string | null;
  name: string;
  phone: string;
  source: LeadSource;
  product_interest: string;
  product_id?: string | null;
  expected_value: number;
  stage: LeadStage;
  lost_reason?: string;
  assigned_to: string; // user id
  assigned_to_name: string;
  created_by: string;
  created_by_name: string;
  last_contact_at?: string;
  next_follow_up_at?: string;
  converted_order_id?: string | null;
  preferred_fragrances?: string[];
  score?: number;
  notes?: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export type InteractionType =
  | 'call'
  | 'messenger'
  | 'whatsapp'
  | 'walk-in'
  | 'sms'
  | 'note'
  | 'other';

export type InteractionDirection = 'inbound' | 'outbound';

export interface CRMInteraction {
  id: string;
  customer_id: string;
  customer_name?: string;
  lead_id?: string | null;
  order_id?: string | null;
  type: InteractionType;
  channel?: string;
  direction: InteractionDirection;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | string;
  outcome?: string;
  next_action?: string;
  follow_up_task_id?: string | null;
  source_reference?: string | null;
  created_by: string;
  created_by_name: string;
  logged_by_name?: string;
  created_at: string;
}

export type CRMTaskPriority = 'low' | 'normal' | 'medium' | 'high' | 'urgent';
export type CRMTaskStatus = 'open' | 'done' | 'completed' | 'snoozed' | 'cancelled';

export interface CRMTask {
  id: string;
  customer_id?: string | null;
  customer_name?: string;
  customer_phone?: string;
  lead_id?: string | null;
  order_id?: string | null;
  task_type?: string;
  title: string;
  description?: string;
  due_at: string; // ISO datetime
  due_date?: string;
  assigned_to: string;
  assigned_to_name: string;
  priority: CRMTaskPriority;
  status: CRMTaskStatus;
  completed_at?: string | null;
  completed_by?: string | null;
  completed_by_name?: string | null;
  snoozed_until?: string | null;
  created_by: string;
  created_by_name: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CRMTag {
  id: string;
  name: string;
  color: string;
  status: 'active' | 'archived';
  created_at: string;
}

export type CustomerLifecycleStatus =
  | 'new'
  | 'active'
  | 'vip'
  | 'at_risk'
  | 'dormant';

export interface CustomerLifecycleRecord {
  customer_id: string;
  status: CustomerLifecycleStatus;
  manual_override: boolean;
  override_reason?: string;
  days_since_last_order?: number;
  computed_at: string;
  updated_by?: string;
  updated_by_name?: string;
}

export interface CustomerPreferences {
  customer_id: string;
  preferred_channel: 'messenger' | 'phone' | 'whatsapp' | 'in_person' | 'sms';
  preferred_contact_time?: string;
  preferred_category?: string;
  preferred_perfume_type?: PerfumeType;
  preferred_fulfillment?: FulfillmentMethod;
  price_sensitivity?: 'budget' | 'moderate' | 'premium' | 'luxury';
  buying_notes?: string;
  favorite_notes?: string[];
  preferred_brands?: string[];
  preferred_concentration?: string;
  scent_family?: string;
  bottle_size_preference?: string;
  notes?: string;
  updated_at: string;
}

export type CRMTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type CRMTicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';

export interface CRMTicket {
  id: string;
  ticket_number: string;
  customer_id: string;
  order_id?: string | null;
  subject: string;
  description: string;
  priority: CRMTicketPriority;
  status: CRMTicketStatus;
  customer_name?: string;
  category?: string;
  resolution?: string;
  assigned_to: string;
  assigned_to_name: string;
  resolution_notes?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  resolved_at?: string | null;
  updated_at: string;
}

export interface CRMFeedback {
  id: string;
  customer_id: string;
  customer_name?: string;
  order_id?: string | null;
  rating: number; // 1 to 5
  comment?: string;
  fragrance_longevity?: number;
  packaging_score?: number;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export type CustomerFeedback = CRMFeedback;

export interface SpecialDate {
  id: string;
  customer_id: string;
  customer_name?: string;
  type: 'birthday' | 'anniversary' | 'eid' | 'other';
  occasion?: string;
  label: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  created_at: string;
}

export type OpportunityStage = 'prospecting' | 'discovery' | 'proposal' | 'negotiation' | 'won' | 'lost' | 'closed_won' | 'closed_lost';
export type OpportunityType = 'corporate_gifting' | 'bulk_purchase' | 'wholesale' | 'event' | 'reseller' | 'other';

export interface Opportunity {
  id: string;
  title: string;
  customer_id?: string | null;
  customer_name?: string;
  lead_id?: string | null;
  value: number;
  probability?: number;
  stage: OpportunityStage;
  expected_close_date?: string;
  closing_date?: string;
  assigned_to: string;
  assigned_to_name: string;
  type: OpportunityType;
  notes?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface CRMCampaign {
  id: string;
  name: string;
  target_segment: string;
  purpose: string;
  start_date: string;
  end_date?: string;
  channel: 'messenger' | 'phone' | 'whatsapp' | 'sms' | 'in_person';
  description?: string;
  responsible_user_id: string;
  responsible_user_name: string;
  target_customer_count: number;
  contacted_count: number;
  converted_count: number;
  notes?: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface CRMAutomationRule {
  id: string;
  name: string;
  trigger_type: 'new_lead' | 'lead_inactivity' | 'order_delivered' | 'customer_dormant' | 'ticket_unresolved' | 'special_date_approaching';
  action_type: 'assign_user' | 'create_task' | 'update_lifecycle';
  config: {
    hours_threshold?: number;
    days_threshold?: number;
    assign_user_id?: string;
    task_title?: string;
    target_lifecycle?: CustomerLifecycleStatus;
  };
  active: boolean;
  created_at: string;
}

export interface UnifiedTimelineEvent {
  id: string;
  timestamp: string;
  category: 'interaction' | 'order' | 'delivery' | 'return' | 'payment' | 'ticket' | 'feedback' | 'task' | 'lifecycle' | 'tag';
  type: string;
  title: string;
  description: string;
  summary?: string;
  notes?: string;
  actor_name?: string;
  ref_id?: string;
  badge_color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate' | 'teal';
  meta?: Record<string, any>;
}

export interface ProductInterest {
  id: string;
  customer_id: string;
  product_id?: string | null;
  product_name: string;
  category_name?: string;
  notes?: string;
  interest_level: 'inquiry' | 'high' | 'waiting_stock' | 'purchased';
  date: string;
}

export interface ReorderOpportunity {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  last_order_date: string;
  days_since_last_order: number;
  avg_reorder_cycle_days: number;
  predicted_category?: string;
  confidence_score: number; // 0 - 100
  reason: string;
}

export interface CustomerSegmentFilter {
  tag_ids?: string[];
  lifecycle_status?: CustomerLifecycleStatus[];
  risk_status?: 'all' | 'risk_only' | 'reliable_only';
  status?: string;
  min_days_since_order?: number;
  max_days_since_order?: number;
  min_orders?: number;
  max_orders?: number;
  min_spent?: number;
  max_spent?: number;
  last_order_within_days?: number;
  last_order_older_than_days?: number;
  has_unresolved_ticket?: boolean;
  has_open_task?: boolean;
  search_query?: string;
}

export interface Customer360Data {
  customer: Customer;
  lifecycle: CustomerLifecycleRecord;
  tags: CRMTag[];
  preferences?: CustomerPreferences | null;
  special_dates: SpecialDate[];
  orders: Order[];
  returns: CustomerReturn[];
  interactions: CRMInteraction[];
  tasks: CRMTask[];
  tickets: CRMTicket[];
  feedback: CRMFeedback[];
  leads: Lead[];
  opportunities: Opportunity[];
  product_interests: ProductInterest[];
  timeline: UnifiedTimelineEvent[];
  stats: {
    total_orders: number;
    delivered_orders: number;
    cancelled_orders: number;
    rto_orders: number;
    total_spent: number;
    avg_order_value: number;
    first_order_date?: string;
    last_order_date?: string;
    days_since_last_order?: number;
    favorite_category?: string;
    favorite_perfume_type?: string;
  };
}

export interface CRMDashboardSummary {
  pipeline_value?: number;
  total_leads?: number;
  conversion_rate?: number;
  leads_by_stage?: Record<string, number>;
  tasks_due_today?: number;
  tasks_overdue?: number;
  csat_avg?: number;
  open_tickets?: number;
  reorder_candidates?: {
    customer_id: string;
    customer_name: string;
    product_id: string;
    product_name: string;
    days_since_last_order: number;
    suggested_product: string;
  }[];
  funnel: {
    new: number;
    contacted: number;
    qualified: number;
    negotiating: number;
    won: number;
    lost: number;
    conversion_rate: number;
  };
  tasks: {
    overdue: number;
    due_today: number;
    upcoming: number;
    completed: number;
  };
  lifecycle: {
    new: number;
    active: number;
    at_risk: number;
    dormant: number;
    vip: number;
    reactivation: number;
  };
  opportunities: {
    count: number;
    total_value: number;
  };
  tickets: {
    open: number;
    in_progress: number;
    waiting: number;
    resolved: number;
    urgent: number;
  };
  upcoming_dates: {
    date: SpecialDate;
    customer_name: string;
    customer_phone: string;
    days_left: number;
  }[];
  reorder_opportunities: ReorderOpportunity[];
}

export interface CRMAnalyticsReport {
  total_leads?: number;
  won_deals?: number;
  total_revenue?: number;
  conversion_rate?: number;
  lead_conversion_rate?: number;
  opportunity_summary: {
    total_deals: number;
    total_pipeline: number;
    won_deals: number;
    won_value: number;
  };
  lifecycle_distribution: Record<string, number>;
  lead_sources: Record<string, number>;
  leads_by_source?: { source: string; count: number; won: number; value: number }[];
  lost_reasons?: { reason: string; count: number }[];
  staff_performance?: { user_id: string; name: string; leads_assigned: number; tasks_completed: number; won_count: number }[];
  retention_metrics?: { total_customers: number; repeat_buyers: number; repeat_rate: number; avg_ltv: number };
}

// --- PHASE 3: PAYMENT ACCOUNTS REPORT & DAILY BUSINESS CONTROL REPORT TYPES ---

export interface PaymentAccountSummaryItem {
  account_id: string;
  account_name: string;
  account_type: PaymentAccountType;
  account_number: string;
  bank_name?: string;
  linked_chart_account_id: string;
  opening_balance: number;
  total_money_in: number;
  total_money_out: number;
  closing_balance: number;
  transaction_count: number;
}

export interface PaymentAccountReportTransaction {
  id: string;
  date: string;
  created_at: string;
  payment_account_id: string;
  payment_account_name: string;
  account_type: PaymentAccountType;
  transaction_type: PaymentAccountStatementItem['transaction_type'];
  reference: string;
  entry_number?: string;
  journal_entry_id?: string;
  description: string;
  money_in: number;
  money_out: number;
  running_balance: number;
  created_by_name: string;
  source_record_type?: 'order' | 'expense' | 'fund_transfer' | 'manual_adjustment' | 'settlement_batch' | 'customer_return' | 'payroll' | 'other';
  source_record_id?: string;
}

export interface PaymentAccountsReportData {
  summary: {
    total_accounts: number;
    opening_balance: number;
    total_money_in: number;
    total_money_out: number;
    closing_balance: number;
    transaction_count: number;
  };
  accounts_summary: PaymentAccountSummaryItem[];
  transactions: PaymentAccountReportTransaction[];
}

export interface DailyBusinessControlReportRow {
  date: string;
  orders_count: number;
  order_quantity: number;
  order_value: number;
  product_quantity: number;
  draft_pending: number;
  delivery_pending: number;
  delivery_done: number;
  return_quantity: number;
  return_amount: number;
  cash_collection: number;
  bank_transfer: number;
  bkash_personal: number;
  bkash_merchant: number;
  nagad: number;
  other_accounts: number;
  total_collection: number;
  cogs_invoice_cost: number;
  operating_expenses: number;
  collection_balance: number;
  order_ids?: string[];
  invoice_numbers?: string[];
}

export interface DailyBusinessControlReportData {
  rows: DailyBusinessControlReportRow[];
  summary: DailyBusinessControlReportRow;
}

export interface FinancialCrossCheckItem {
  id: string;
  title: string;
  description: string;
  operational_metric_label: string;
  operational_amount: number;
  accounting_metric_label: string;
  accounting_amount: number;
  variance: number;
  is_balanced: boolean;
  status: 'balanced' | 'discrepancy';
  notes?: string;
}

export interface FinancialCrossCheckReport {
  as_of_date: string;
  is_fully_balanced: boolean;
  total_checks: number;
  balanced_checks: number;
  checks: FinancialCrossCheckItem[];
}

// ============================================================================
// Stock Reports & History Types (Inventory Reporting)
// ============================================================================
export interface StockReportItem {
  id: string; // product_id
  sku: string;
  name: string;
  display_name: string;
  brand: string;
  category_id?: string;
  category_name?: string;
  location: string;
  selling_price: number;
  avg_cost: number;
  current_stock: number;
  available_stock: number;
  closing_stock_value_purchase: number;
  closing_stock_value_sale: number;
  potential_profit: number;
  profit_margin_pct: number;
  total_unit_sold: number;
  total_transferred: number;
  total_adjusted: number;
}

export interface StockReportSummary {
  total_stock_on_hand: number;
  closing_stock_value_purchase: number;
  closing_stock_value_sale: number;
  potential_profit: number;
  profit_margin_pct: number;
  total_units_sold: number;
  total_transferred: number;
  total_adjusted: number;
  total_products_count: number;
  low_stock_count?: number;
}

export interface StockReportResponse {
  summary: StockReportSummary;
  products: StockReportItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ProductStockHistorySummary {
  total_purchase: number;
  opening_stock: number;
  total_sell_return: number;
  stock_transfers_in: number;
  total_sold: number;
  total_stock_adjustment: number;
  total_purchase_return: number;
  stock_transfers_out: number;
  current_stock: number;
  total_inflow: number;
  total_outflow: number;
}

export interface ProductStockHistoryMovement {
  id: string;
  movement_reason: StockMovementReason;
  reason_label: string;
  quantity_delta: number;
  previous_quantity: number;
  new_quantity: number; // running balance
  created_at: string;
  reference_id: string;
  warehouse_id: string;
  warehouse_name: string;
  unit_cost: number;
  total_cost: number;
  customer_name: string | null;
  supplier_name: string | null;
  party_name: string | null;
  notes?: string;
}

export interface ProductStockHistoryResponse {
  product: {
    id: string;
    sku: string;
    display_name: string;
    brand: string;
    category_name?: string;
    selling_price: number;
    avg_cost: number;
    current_stock: number;
  };
  warehouse_id: string;
  summary: ProductStockHistorySummary;
  movements: ProductStockHistoryMovement[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}


