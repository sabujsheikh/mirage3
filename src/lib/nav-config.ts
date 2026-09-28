/**
 * Literal implementation of Section 36.4a NAV_CONFIG
 * The single source of truth for sidebar navigation
 */

export interface NavChild {
  label: string;
  path: string;
  badgeKey?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path?: string;
  children?: NavChild[];
  requiresTier?: string[];
  badgeKey?: string;
}

export const NAV_CONFIG: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
  {
    id: 'orders',
    label: 'Orders',
    icon: 'ShoppingCart',
    children: [
      { label: 'New Order', path: '/orders/new' },
      { label: 'Walk-in Sale', path: '/orders/walk-in' },
      { label: "Today's Orders", path: '/orders/today' },
      { label: 'Scheduled Orders', path: '/orders/scheduled', badgeKey: 'scheduled_orders' },
      { label: 'Pre-Orders', path: '/orders/pre-orders', badgeKey: 'pre_orders' },
      { label: 'All Sales & Orders', path: '/orders' },
      { label: 'Cancelled Orders', path: '/orders/cancelled' },
      { label: 'Returns & RTO', path: '/orders/returns' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: 'Users',
    path: '/customers',
    requiresTier: ['owner', 'general_manager', 'manager', 'packing_staff'],
  },
  {
    id: 'packing',
    label: 'Packing',
    icon: 'PackageCheck',
    path: '/packing',
    badgeKey: 'pending_packing',
    requiresTier: ['owner', 'general_manager', 'manager', 'packing_staff'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'Boxes',
    children: [
      { label: 'Products', path: '/inventory/products' },
      { label: 'Stock Report', path: '/inventory/stock-report' },
      { label: 'Locations', path: '/inventory/locations' },
      { label: 'Stock Movements', path: '/inventory/movements' },
      { label: 'Stock Transfer', path: '/inventory/transfer' },
      { label: 'Batches', path: '/inventory/batches' },
      { label: 'Testers', path: '/inventory/testers' },
      { label: 'Fragrance Notes', path: '/inventory/fragrance-notes' },
    ],
  },
  {
    id: 'purchasing',
    label: 'Purchasing',
    icon: 'Truck',
    requiresTier: ['owner', 'general_manager', 'manager'],
    children: [
      { label: 'Suppliers', path: '/purchasing/suppliers' },
      { label: 'Purchase Orders', path: '/purchasing/orders' },
      { label: 'Purchase Returns', path: '/purchasing/returns' },
    ],
  },
  {
    id: 'courier',
    label: 'Courier',
    icon: 'Send',
    requiresTier: ['owner', 'general_manager', 'manager', 'packing_staff'],
    children: [
      { label: 'Booking History', path: '/courier/bookings' },
      { label: 'Live Tracking', path: '/courier/tracking' },
      { label: 'RTO Tracking', path: '/courier/rto' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM & Relations',
    icon: 'HeartHandshake',
    requiresTier: ['owner', 'general_manager', 'manager'],
    children: [
      { label: 'CRM Dashboard', path: '/crm/dashboard' },
      { label: 'Leads & Inquiries', path: '/crm/leads' },
      { label: 'Follow-ups & Tasks', path: '/crm/tasks' },
      { label: 'Customer 360', path: '/crm/customers' },
      { label: 'Segments & Tags', path: '/crm/segments' },
      { label: 'Interactions & Timeline', path: '/crm/interactions' },
      { label: 'Automations', path: '/crm/automations' },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: 'Landmark',
    requiresTier: ['owner', 'general_manager'],
    children: [
      { label: 'Sales & Payments', path: '/accounting/sales-payments' },
      { label: 'Transaction Ledger', path: '/accounting/ledger' },
      { label: 'Income', path: '/accounting/income' },
      { label: 'Expenses', path: '/accounting/expenses' },
      { label: 'Payment Accounts', path: '/accounting/payments' },
      { label: 'Salary & Payslips', path: '/accounting/salary' },
      { label: 'Reconciliation', path: '/accounting/reconciliation' },
      { label: 'Payable & Receivable', path: '/accounting/payable-receivable' },
      { label: 'Profit & Loss', path: '/accounting/pnl' },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing',
    icon: 'Tag',
    requiresTier: ['owner', 'general_manager', 'manager'],
    children: [
      { label: 'Pricing Engine', path: '/pricing/engine' },
      { label: 'Market/Competitor Data', path: '/pricing/market' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: 'ClipboardList',
    requiresTier: ['owner', 'general_manager', 'manager', 'packing_staff'],
    children: [
      { label: 'Packaging Materials', path: '/operations/packaging' },
      { label: 'Staff Directory & HR', path: '/operations/staff' },
    ],
  },
  { id: 'reports', label: 'Reports', icon: 'FileBarChart', path: '/reports', requiresTier: ['owner', 'general_manager', 'manager'] },
  { id: 'users', label: 'Users & Roles', icon: 'ShieldCheck', path: '/settings/users', requiresTier: ['owner', 'general_manager'] },
  { id: 'audit', label: 'Audit Log', icon: 'History', path: '/audit-log', requiresTier: ['owner', 'general_manager'] },
  { id: 'settings', label: 'Settings', icon: 'Settings', path: '/settings', requiresTier: ['owner', 'general_manager'] },
];
