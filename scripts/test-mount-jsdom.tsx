import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/',
  pretendToBeVisual: true,
});

(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).HTMLInputElement = dom.window.HTMLInputElement;
(globalThis as any).HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
(globalThis as any).HTMLSelectElement = dom.window.HTMLSelectElement;
(globalThis as any).KeyboardEvent = dom.window.KeyboardEvent;
(globalThis as any).MouseEvent = dom.window.MouseEvent;
(globalThis as any).localStorage = dom.window.localStorage;
(globalThis as any).sessionStorage = dom.window.sessionStorage;
(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
const mockMM = () => ({
  matches: false,
  media: '',
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});
(globalThis as any).matchMedia = mockMM;
dom.window.matchMedia = mockMM as any;

// Store a mock session token
dom.window.localStorage.setItem('mirage_session_token', 'mock_token');

const nativeFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string, init?: any) => {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  // Add auth header if not present
  const modifiedInit = { ...init };
  modifiedInit.headers = {
    ...(init?.headers || {}),
    Authorization: 'Bearer mock_token',
  };
  return nativeFetch(fullUrl, modifiedInit);
};

import React from 'react';
import { createRoot } from 'react-dom/client';
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

const allTestViews = [
  { name: 'Contacts: Customers', el: <CustomersView /> },
  { name: 'Contacts: Customer Profile', el: <CustomerProfileView /> },
  { name: 'Contacts: Supplier Profile', el: <SupplierProfileView /> },
  
  { name: 'Accounting: Transaction Ledger', el: <JournalView /> },
  { name: 'Accounting: Income', el: <IncomeView /> },
  { name: 'Accounting: Expenses', el: <ExpensesView /> },
  { name: 'Accounting: Payments', el: <PaymentsView /> },
  { name: 'Accounting: Salary & Payslips', el: <PayrollView /> },
  { name: 'Accounting: Reconciliation', el: <ReconciliationView /> },
  { name: 'Accounting: Payable & Receivable', el: <PayableReceivableView /> },
  { name: 'Accounting: Profit & Loss', el: <FinancialReportsView /> },
];

async function testSingle(name: string, element: React.ReactElement) {
  const container = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);

  let errorCaught: any = null;
  const errorHandler = (evt: any) => {
    errorCaught = evt.error || evt.message || evt;
  };
  dom.window.addEventListener('error', errorHandler);

  try {
    root.render(
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            {element}
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    );

    await new Promise((r) => setTimeout(r, 400));
    if (errorCaught) {
      console.log(`[FAIL] ${name} -> Error: ${errorCaught.message || errorCaught}`);
    } else if (container.innerHTML.length === 0) {
      console.log(`[FAIL] ${name} -> Rendered EMPTY HTML (blank screen)`);
    } else {
      console.log(`[PASS] ${name} -> Rendered successfully (${container.innerHTML.length} chars)`);
    }
  } catch (err: any) {
    console.log(`[FAIL-THROW] ${name} -> Threw: ${err.message}`);
  } finally {
    dom.window.removeEventListener('error', errorHandler);
    try { root.unmount(); } catch {}
    dom.window.document.body.removeChild(container);
  }
}

async function run() {
  for (const item of allTestViews) {
    await testSingle(item.name, item.el);
  }
  process.exit(0);
}

run();
