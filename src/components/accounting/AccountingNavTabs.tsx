import React from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export const AccountingNavTabs: React.FC = () => {
  const { activePath, setActivePath } = useApp();
  const { currentUser, can, tier } = useAuth();

  const canAccessSalesFinancialLedger = Boolean(
    currentUser && (
      tier === 1 ||
      tier === 2 ||
      can('view_sales_financial_ledger') ||
      currentUser.capabilities?.includes('view_sales_financial_ledger') ||
      currentUser.toggles?.['view_sales_financial_ledger'] === true
    )
  );

  const tabs = [
    ...(canAccessSalesFinancialLedger ? [{ label: 'Sales & Payments', path: '/accounting/sales-payments' }] : []),
    { label: 'Transaction Ledger', path: '/accounting/ledger' },
    { label: 'Income', path: '/accounting/income' },
    { label: 'Expenses', path: '/accounting/expenses' },
    { label: 'Payment Accounts', path: '/accounting/payments' },
    { label: 'Salary & Payslips', path: '/accounting/salary' },
    { label: 'Reconciliation', path: '/accounting/reconciliation' },
    { label: 'Payable & Receivable', path: '/accounting/payable-receivable' },
    { label: 'Profit & Loss', path: '/accounting/pnl' },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[var(--border)] scrollbar-thin">
      {tabs.map((tab) => {
        const isActive = activePath === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => setActivePath(tab.path)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              isActive
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] border border-[var(--border)]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
