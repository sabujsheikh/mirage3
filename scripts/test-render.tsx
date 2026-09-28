import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { AppProvider } from '../src/context/AppContext';
import { CRMManagementView } from '../src/components/crm/CRMManagementView';
import { JournalView } from '../src/components/accounting/JournalView';
import { IncomeView } from '../src/components/accounting/IncomeView';
import { ExpensesView } from '../src/components/accounting/ExpensesView';
import { PaymentsView } from '../src/components/accounting/PaymentsView';
import { PayrollView } from '../src/components/accounting/PayrollView';
import { ReconciliationView } from '../src/components/accounting/ReconciliationView';
import { PayableReceivableView } from '../src/components/accounting/PayableReceivableView';
import { FinancialReportsView } from '../src/components/accounting/FinancialReportsView';

const views = [
  { name: 'CRM - Dashboard', el: <CRMManagementView initialTab="dashboard" /> },
  { name: 'CRM - Leads', el: <CRMManagementView initialTab="leads" /> },
  { name: 'CRM - Tasks', el: <CRMManagementView initialTab="tasks" /> },
  { name: 'CRM - Customers', el: <CRMManagementView initialTab="customer360" /> },
  { name: 'CRM - Segments', el: <CRMManagementView initialTab="segments" /> },
  { name: 'CRM - Interactions', el: <CRMManagementView initialTab="interactions" /> },
  { name: 'CRM - Automations', el: <CRMManagementView initialTab="automations" /> },
  { name: 'Accounting - Journal', el: <JournalView /> },
  { name: 'Accounting - Income', el: <IncomeView /> },
  { name: 'Accounting - Expenses', el: <ExpensesView /> },
  { name: 'Accounting - Payments', el: <PaymentsView /> },
  { name: 'Accounting - Payroll', el: <PayrollView /> },
  { name: 'Accounting - Reconciliation', el: <ReconciliationView /> },
  { name: 'Accounting - PayableReceivable', el: <PayableReceivableView /> },
  { name: 'Accounting - PnL', el: <FinancialReportsView /> },
];

for (const v of views) {
  try {
    const html = ReactDOMServer.renderToString(
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            {v.el}
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    );
    console.log(`PASS: ${v.name} (html len: ${html.length})`);
  } catch (err: any) {
    console.error(`FAIL: ${v.name}:`, err.message);
  }
}
