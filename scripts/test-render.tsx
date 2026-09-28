import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { AppProvider } from '../src/context/AppContext';
import { CustomersView } from '../src/components/customers/CustomersView';
import { CustomerProfileView } from '../src/components/customers/CustomerProfileView';
import { SupplierProfileView } from '../src/components/purchasing/SupplierProfileView';
import { JournalView } from '../src/components/accounting/JournalView';
import { IncomeView } from '../src/components/accounting/IncomeView';
import { ExpensesView } from '../src/components/accounting/ExpensesView';
import { PaymentsView } from '../src/components/accounting/PaymentsView';
import { PayrollView } from '../src/components/accounting/PayrollView';
import { ReconciliationView } from '../src/components/accounting/ReconciliationView';
import { PayableReceivableView } from '../src/components/accounting/PayableReceivableView';
import { FinancialReportsView } from '../src/components/accounting/FinancialReportsView';

const views = [
  { name: 'Contacts - Customers', el: <CustomersView /> },
  { name: 'Contacts - Customer Profile', el: <CustomerProfileView /> },
  { name: 'Contacts - Supplier Profile', el: <SupplierProfileView /> },
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
