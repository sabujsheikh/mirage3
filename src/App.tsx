import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { KeyboardShortcutsModal } from './components/common/KeyboardShortcutsModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Views
import { DashboardView } from './components/dashboard/DashboardView';
import { NewOrderMessenger } from './components/orders/NewOrderMessenger';
import { WalkInPOS } from './components/orders/WalkInPOS';
import { TodaysOrdersView } from './components/orders/TodaysOrdersView';
import { AllOrdersView } from './components/orders/AllOrdersView';
import { CancelledOrdersView } from './components/orders/CancelledOrdersView';
import { PreOrdersView } from './components/orders/PreOrdersView';
import { ScheduledOrdersView } from './components/orders/ScheduledOrdersView';
import { OrdersList } from './components/orders/OrdersList';
import { PackingView } from './components/packing/PackingView';
import { PackagingMaterialsView } from './components/operations/PackagingMaterialsView';
import { CourierBookingsView } from './components/courier/CourierBookingsView';
import { ProductsView } from './components/inventory/ProductsView';
import { LocationsView } from './components/inventory/LocationsView';
import { BatchesView } from './components/inventory/BatchesView';
import { StockLedgerView } from './components/inventory/StockLedgerView';
import { TestersView } from './components/inventory/TestersView';
import { ReservationsView } from './components/inventory/ReservationsView';
import { StockTransferView } from './components/inventory/StockTransferView';
import { FragranceNotesView } from './components/inventory/FragranceNotesView';
import { StockReportView } from './components/inventory/StockReportView';
import { ProductStockHistoryView } from './components/inventory/ProductStockHistoryView';
import { SuppliersView } from './components/purchasing/SuppliersView';
import { PurchaseOrdersView } from './components/purchasing/PurchaseOrdersView';
import { PurchaseReturnsView } from './components/purchasing/PurchaseReturnsView';
import { CustomerReturnsView } from './components/returns/CustomerReturnsView';
import { CustomersView } from './components/customers/CustomersView';
import { CustomerProfileView } from './components/customers/CustomerProfileView';
import { SupplierProfileView } from './components/purchasing/SupplierProfileView';
import { JournalView } from './components/accounting/JournalView';
import { DailyCashTillView } from './components/accounting/DailyCashTillView';
import { CashierDailyClosingView } from './components/accounting/CashierDailyClosingView';
import { ExpensesView } from './components/accounting/ExpensesView';
import { PayrollView } from './components/accounting/PayrollView';
import { FinancialReportsView } from './components/accounting/FinancialReportsView';
import { PrintReportsView } from './components/dashboard/PrintReportsView';
import { DynamicPricingView } from './components/pricing/DynamicPricingView';
import { UsersView } from './components/settings/UsersView';
import { AuditLogView } from './components/audit/AuditLogView';
import { SettingsView } from './components/settings/SettingsView';
import { SystemSecurityView } from './components/settings/SystemSecurityView';
import { UserProfileView } from './components/profile/UserProfileView';
import { HRManagementView } from './components/hr/HRManagementView';
import { LoginView } from './components/auth/LoginView';
import { IncomeView } from './components/accounting/IncomeView';
import { PaymentsView } from './components/accounting/PaymentsView';
import { PayableReceivableView } from './components/accounting/PayableReceivableView';
import { ReconciliationView } from './components/accounting/ReconciliationView';
import { SalesPaymentsAccountingView } from './components/accounting/SalesPaymentsAccountingView';
import { ShieldAlert } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { currentUser, isAuthenticated, isLoading, can, tier } = useAuth();
  const { activePath, setActivePath, isInitialized, sidebarOpen, setSidebarOpen } = useApp();
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  const canAccessSalesFinancialLedger = Boolean(
    currentUser && (
      tier === 1 ||
      tier === 2 ||
      can('view_sales_financial_ledger') ||
      currentUser.capabilities?.includes('view_sales_financial_ledger') ||
      currentUser.toggles?.['view_sales_financial_ledger'] === true
    )
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          setActivePath('/orders/new');
        } else if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          setActivePath('/orders/walk-in');
        } else if (e.key.toLowerCase() === 'o') {
          e.preventDefault();
          setActivePath('/orders');
        } else if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          setActivePath('/dashboard');
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          setActivePath('/inventory/products');
        } else if (e.key === '/') {
          e.preventDefault();
          setShowShortcutsModal(prev => !prev);
        }
      } else if (!isInput) {
        if (e.key === '?') {
          e.preventDefault();
          setShowShortcutsModal(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActivePath]);

  const renderActiveView = () => {
    const basePath = activePath.split('?')[0];
    switch (basePath) {
      case '/dashboard':
        return <DashboardView />;
      case '/orders/new':
        return <NewOrderMessenger />;
      case '/orders/walk-in':
        return <WalkInPOS />;
      case '/orders/daily-closing':
      case '/accounting/daily-closing':
        return <CashierDailyClosingView />;
      case '/orders/today':
        return <TodaysOrdersView />;
      case '/orders/scheduled':
        return <ScheduledOrdersView />;
      case '/orders/pre-orders':
        return <PreOrdersView />;
      case '/orders':
        return <AllOrdersView />;
      case '/orders/cancelled':
        return <CancelledOrdersView />;
      case '/orders/returns':
      case '/courier/rto':
      case '/returns':
        return <CustomerReturnsView />;
      case '/packing':
        return <PackingView />;
      case '/operations/packaging':
        return <PackagingMaterialsView />;
      case '/courier':
      case '/courier/bookings':
      case '/courier/tracking':
      case '/courier/reconciliation':
        return <CourierBookingsView />;
      case '/inventory':
      case '/inventory/products':
        return <ProductsView />;
      case '/inventory/stock-report':
      case '/reports/stock':
        return <StockReportView />;
      case '/inventory/stock-history':
      case '/reports/stock-history':
        return <ProductStockHistoryView />;
      case '/inventory/locations':
        return <LocationsView />;
      case '/inventory/batches':
        return <BatchesView />;
      case '/inventory/movements':
      case '/inventory/ledger':
        return <StockLedgerView />;
      case '/inventory/testers':
        return <TestersView />;
      case '/inventory/reservations':
        return <ReservationsView />;
      case '/inventory/transfer':
        return <StockTransferView />;
      case '/inventory/fragrance-notes':
        return <FragranceNotesView />;
      case '/purchasing/suppliers':
      case '/purchasing/reconciliation':
        return <SuppliersView />;
      case '/purchasing/orders':
      case '/purchasing/receive':
        return <PurchaseOrdersView />;
      case '/purchasing/returns':
        return <PurchaseReturnsView />;
      case '/customers':
        return <CustomersView />;
      case '/accounting/ledger':
        return <JournalView />;
      case '/accounting/income':
        return <IncomeView />;
      case '/accounting/pnl':
        return <FinancialReportsView />;
      case '/reports':
        return <PrintReportsView />;
      case '/accounting/expenses':
        return <ExpensesView />;
      case '/accounting/payments':
      case '/accounting/payment-accounts':
        return <PaymentsView />;
      case '/accounting/daily-till':
      case '/accounting/cash-register':
        return <DailyCashTillView />;
      case '/accounting/salary':
      case '/payroll':
        return <PayrollView />;
      case '/accounting/sales-payments':
        return canAccessSalesFinancialLedger ? (
          <SalesPaymentsAccountingView />
        ) : (
          <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-[var(--text)]">Access Restricted</h2>
              <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                The Sales & Payments financial ledger is restricted to Owner (Tier 1), Accountant (Tier 2), or staff explicitly granted the <code className="text-[var(--accent)] font-mono">view_sales_financial_ledger</code> permission toggle.
              </p>
            </div>
          </div>
        );
      case '/accounting/reconciliation':
        return <ReconciliationView />;
      case '/accounting/payable-receivable':
        return <PayableReceivableView />;
      case '/customers/profile':
        return <CustomerProfileView />;
      case '/purchasing/suppliers/profile':
        return <SupplierProfileView />;
      case '/pricing':
      case '/pricing/engine':
      case '/pricing/market':
        return <DynamicPricingView />;
      case '/hr':
      case '/operations/staff':
      case '/hr/employees':
      case '/hr/attendance':
      case '/hr/leaves':
      case '/hr/payroll':
      case '/hr/recruitment':
      case '/hr/performance':
      case '/hr/offboarding':
        return <HRManagementView currentUser={currentUser} />;
      case '/settings/users':
        return <UsersView />;
      case '/settings/security':
      case '/settings/backups':
        return <SystemSecurityView />;
      case '/profile':
      case '/my-profile':
        return <UserProfileView />;
      case '/audit-log':
      case '/audit-logs':
        return <AuditLogView />;
      case '/settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };


  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-[var(--text)] tracking-wide uppercase">
            Loading Mirage Perfume ERP...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <LoginView />;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--text)] font-sans antialiased transition-colors">
      {/* Unified TopBar - ONE continuous header across the entire top of the application */}
      <TopBar />

      {/* Application Body: Sidebar + Main Canvas underneath the top header */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Mobile backdrop overlay - only on small screens (< md) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity md:hidden"
            onClick={() => setSidebarOpen(false)}
            title="Click to collapse sidebar"
          />
        )}

        {/* Collapsible Sidebar: full width drawer on mobile / rail or expanded on desktop */}
        <div
          className={`h-full shrink-0 z-50 md:z-30 transition-all duration-200 ease-in-out bg-[var(--sidebar-bg)] border-r border-[var(--border)] ${
            sidebarOpen
              ? 'w-72 max-w-[85vw] translate-x-0 fixed top-0 bottom-0 left-0 shadow-2xl md:shadow-none md:static md:top-14 md:w-64'
              : 'w-0 -translate-x-full fixed top-0 bottom-0 left-0 md:translate-x-0 md:w-16 md:static md:top-14'
          }`}
        >
          <Sidebar />
        </div>

        {/* Scrollable View Canvas - Expands to fill available space, with safe padding for mobile bottom bar */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-20 md:pb-6 scrollbar-thin min-w-0 bg-[var(--bg)]">
          <ErrorBoundary key={activePath} onReset={() => setActivePath('/dashboard')}>
            {renderActiveView()}
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Navigation Quick Bar */}
      <MobileBottomNav />

      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <MainLayout />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

