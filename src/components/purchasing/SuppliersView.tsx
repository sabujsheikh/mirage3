import { PageHeader } from '../common/PageHeader';
import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  Building2,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Receipt,
  Globe2,
  TrendingDown,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Supplier, CurrencyCode, SupplierPayment } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

export const SuppliersView: React.FC = () => {
  const {
    suppliers,
    createSupplier,
    updateSupplier,
    recordSupplierPayment,
    fetchSupplierStatement,
    accounts,
    purchaseOrders,
    purchaseReturns,
  } = useApp();
  const { can } = useAuth();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [showPayableOnly, setShowPayableOnly] = useState<boolean>(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);

  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [statementData, setStatementData] = useState<any>(null);
  const [statementLoading, setStatementLoading] = useState<boolean>(false);

  // Form State for Add / Edit
  const [name, setName] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [country, setCountry] = useState<string>('UAE');
  const [currency, setCurrency] = useState<CurrencyCode>('AED');
  const [defaultExchangeRate, setDefaultExchangeRate] = useState<number>(33.0);
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 30');
  const [taxId, setTaxId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [initialPayable, setInitialPayable] = useState<number>(0);
  const [active, setActive] = useState<boolean>(true);

  // Payment Form State
  const [payAmountBdt, setPayAmountBdt] = useState<number>(0);
  const [payAmountForeign, setPayAmountForeign] = useState<number>(0);
  const [payAccountId, setPayAccountId] = useState<string>('acc_bank');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Filtering
  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contact_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery) ||
      s.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCurrency = currencyFilter === 'all' || s.currency === currencyFilter;
    const matchesPayable = !showPayableOnly || s.balance_payable > 0;
    return matchesSearch && matchesCurrency && matchesPayable;
  });

  // KPIs
  const totalSuppliers = suppliers.length;
  const totalPayableBdt = suppliers.reduce((sum, s) => sum + (s.balance_payable || 0), 0);
  const uaeSuppliersCount = suppliers.filter(s => s.country.toUpperCase() === 'UAE').length;
  const localSuppliersCount = suppliers.filter(s => s.country.toUpperCase() === 'BANGLADESH').length;

  const handleOpenAdd = () => {
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCountry('UAE');
    setCurrency('AED');
    setDefaultExchangeRate(33.0);
    setPaymentTerms('Net 30');
    setTaxId('');
    setNotes('');
    setInitialPayable(0);
    setActive(true);
    setErrorMsg('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name);
    setContactPerson(s.contact_person || '');
    setPhone(s.phone || '');
    setEmail(s.email || '');
    setAddress(s.address || '');
    setCountry(s.country || 'UAE');
    setCurrency(s.currency || 'AED');
    setDefaultExchangeRate(s.default_exchange_rate || 33.0);
    setPaymentTerms(s.payment_terms || 'Net 30');
    setTaxId(s.tax_id_or_trade_license || '');
    setNotes(s.notes || '');
    setActive(s.active !== false);
    setErrorMsg('');
    setShowEditModal(true);
  };

  const handleOpenPayment = (s: Supplier) => {
    setPayingSupplier(s);
    setPayAmountBdt(s.balance_payable > 0 ? s.balance_payable : 0);
    const rate = s.default_exchange_rate || (s.currency === 'AED' ? 33.0 : s.currency === 'USD' ? 122.0 : 1.0);
    setPayAmountForeign(s.balance_payable > 0 ? Math.round((s.balance_payable / rate) * 100) / 100 : 0);
    setPayAccountId(accounts.find(a => a.id === 'acc_bank')?.id || 'acc_bank');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayRef(`TT-${Date.now().toString().slice(-6)}`);
    setPayNotes(`Settlement of accounts payable balance for ${s.name}`);
    setErrorMsg('');
    setShowPaymentModal(true);
  };

  const handleOpenStatement = async (s: Supplier) => {
    setStatementSupplier(s);
    setStatementLoading(true);
    setShowStatementModal(true);
    try {
      const data = await fetchSupplierStatement(s.id);
      setStatementData(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setStatementLoading(false);
    }
  };

  const handleCurrencyChange = (curr: CurrencyCode) => {
    setCurrency(curr);
    if (curr === 'AED') setDefaultExchangeRate(33.0);
    else if (curr === 'USD') setDefaultExchangeRate(122.0);
    else if (curr === 'EUR') setDefaultExchangeRate(133.0);
    else setDefaultExchangeRate(1.0);
  };

  const handlePayBdtChange = (bdt: number) => {
    setPayAmountBdt(bdt);
    if (payingSupplier) {
      const rate = payingSupplier.default_exchange_rate || 1;
      setPayAmountForeign(Math.round((bdt / rate) * 100) / 100);
    }
  };

  const handlePayForeignChange = (foreign: number) => {
    setPayAmountForeign(foreign);
    if (payingSupplier) {
      const rate = payingSupplier.default_exchange_rate || 1;
      setPayAmountBdt(Math.round(foreign * rate));
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Supplier name is required');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          name,
          contact_person: contactPerson,
          phone,
          email,
          address,
          country,
          currency,
          default_exchange_rate: Number(defaultExchangeRate),
          payment_terms: paymentTerms,
          tax_id_or_trade_license: taxId,
          notes,
          active,
        });
        setShowEditModal(false);
      } else {
        await createSupplier({
          name,
          contact_person: contactPerson,
          phone,
          email,
          address,
          country,
          currency,
          default_exchange_rate: Number(defaultExchangeRate),
          payment_terms: paymentTerms,
          tax_id_or_trade_license: taxId,
          notes,
          initial_balance_payable: Number(initialPayable),
        });
        setShowAddModal(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier) return;
    if (payAmountBdt <= 0) {
      setErrorMsg('Payment amount must be greater than 0');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await recordSupplierPayment(payingSupplier.id, {
        amount_bdt: Number(payAmountBdt),
        amount_foreign: Number(payAmountForeign) || undefined,
        payment_account_id: payAccountId,
        payment_date: payDate,
        reference_no: payRef,
        notes: payNotes,
      });
      setShowPaymentModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record supplier payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" id="suppliers-view-container">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[var(--accent)]" />
            Supplier Management & Payables
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Section 13 & 15: Manage Dubai fragrance trading houses, European exporters, and local packaging vendors.
          </p>
        </div>

        {can('manage_suppliers') && (
          <button
            id="btn-add-supplier"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-95 shadow-sm transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Supplier
          </button>
        )}
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Suppliers</p>
            <p className="text-2xl font-black text-[var(--text)] mt-1">{totalSuppliers}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{uaeSuppliersCount} UAE &#8226; {localSuppliersCount} Local</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] text-[var(--status-teal)] flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Payables Owed</p>
            <p className="text-2xl font-black text-[var(--status-red)] mt-1">&#2547;{totalPayableBdt.toLocaleString()}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Accounts Payable (Dubai & Local)</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)] flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">UAE Exporters (AED)</p>
            <p className="text-2xl font-black text-[var(--text)] mt-1">{uaeSuppliersCount}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Benchmark Rate: 1 AED = 33.0 BDT</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] text-[var(--status-amber)] flex items-center justify-center font-bold">
            <Globe2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Open Purchase Orders</p>
            <p className="text-2xl font-black text-[var(--text)] mt-1">
              {purchaseOrders.filter(p => p.status !== 'received' && p.status !== 'cancelled').length}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Pending cargo shipments</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)] flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search suppliers by name, phone, country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All Currencies</option>
            <option value="AED">AED (UAE Dirham)</option>
            <option value="EUR">EUR (Euro)</option>
            <option value="USD">USD (US Dollar)</option>
            <option value="BDT">BDT (Bangladeshi Taka)</option>
          </select>

          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPayableOnly}
              onChange={(e) => setShowPayableOnly(e.target.checked)}
              className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-0"
            />
            Outstanding Balance Only
          </label>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dense-table">
            <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Supplier & Origin</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Currency & Terms</th>
                <th className="py-3 px-4">Purchases Total</th>
                <th className="py-3 px-4 text-right">Payables Balance</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                    No suppliers match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[var(--text)] flex items-center gap-2">
                        {s.name}
                        {!s.active && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-200 text-neutral-600 font-bold">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3 h-3 text-[var(--accent)]" />
                        <span>{s.country} &#8226; {s.address || 'Direct Consolidation'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-[var(--text)]">{s.contact_person || '\u2014'}</div>
                      <div className="text-[11px] text-[var(--text-muted)] flex flex-col gap-0.5 mt-0.5">
                        {s.phone && <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {s.phone}</span>}
                        {s.email && <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {s.email}</span>}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] text-[var(--status-amber)]">
                          {s.currency}
                        </span>
                        {s.currency !== 'BDT' && (
                          <span className="text-[11px] text-[var(--text-muted)]">
                            (1 {s.currency} &#8776; &#2547;{s.default_exchange_rate})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1">
                        Terms: <span className="font-semibold text-[var(--text)]">{s.payment_terms || 'Net 30'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-[var(--text)]">&#2547;{(s.total_purchases_amount_bdt || 0).toLocaleString()}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{s.total_purchases_count || 0} Purchase Orders</div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className={`font-black text-sm ${s.balance_payable > 0 ? 'text-[var(--status-red)]' : 'text-[var(--status-green)]'}`}>
                        &#2547;{(s.balance_payable || 0).toLocaleString()}
                      </div>
                      {s.currency !== 'BDT' && s.balance_payable > 0 && (
                        <div className="text-[10px] text-[var(--text-muted)]">
                          &#8776; {Math.round(s.balance_payable / (s.default_exchange_rate || 1)).toLocaleString()} {s.currency}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {s.balance_payable > 0 && can('manage_accounting') && (
                          <button
                            onClick={() => handleOpenPayment(s)}
                            title="Record Payment / Settlement"
                            className="px-2.5 py-1 bg-[var(--status-green)] hover:opacity-90 text-white rounded text-[11px] font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <CreditCard className="w-3 h-3" />
                            Settle
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenStatement(s)}
                          title="View Statement & History"
                          className="p-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--accent)] hover:text-white rounded transition-colors cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>

                        {can('manage_suppliers') && (
                          <button
                            onClick={() => handleOpenEdit(s)}
                            title="Edit Supplier"
                            className="p-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--accent)] hover:text-white rounded transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL: Add / Edit Supplier --- */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {showEditModal ? `Edit Supplier: ${editingSupplier?.name}` : 'Add New Supplier Profile'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text)] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Supplier / Trading House Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dubai Wholesale Fragrance Trading LLC"
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Rashid Al-Mansoor"
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +971 4 223 8890"
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. export@fragrancetrading.ae"
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Country of Origin</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. UAE, France, Bangladesh"
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Address / Warehouse Location</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Warehouse 14, Al Quoz Industrial 3, Dubai, UAE"
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Primary Invoicing Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-semibold"
                  >
                    <option value="AED">AED - UAE Dirham</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="BDT">BDT - Bangladeshi Taka</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Default Exchange Rate to BDT</label>
                  <input
                    type="number"
                    step="0.01"
                    value={defaultExchangeRate}
                    onChange={(e) => setDefaultExchangeRate(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-bold text-[var(--status-amber)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="e.g. 50% Advance, Net 30, LC"
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Tax ID / TRN / Trade License</label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="e.g. TRN-10029384910003"
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                {!editingSupplier && (
                  <div className="sm:col-span-2 p-3 bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-amber)_20%,transparent)] rounded-xl">
                    <label className="block text-xs font-bold text-[var(--text)] mb-1">
                      Initial Opening Balance Payable (BDT)
                    </label>
                    <input
                      type="number"
                      value={initialPayable}
                      onChange={(e) => setInitialPayable(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-bold text-[var(--status-red)]"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      If migrating legacy accounts, this posts Dr Equity, Cr Supplier Payables.
                    </p>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Notes / Brand Authorizations</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special freight instructions, direct brand agencies (Lattafa, Afnan, Rasasi, etc.)"
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                {editingSupplier && (
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="supplier-active-check"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="rounded border-[var(--border)] text-[var(--accent)]"
                    />
                    <label htmlFor="supplier-active-check" className="text-xs font-semibold text-[var(--text)] cursor-pointer">
                      Supplier Active for new Purchase Orders
                    </label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--border)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-95 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : showEditModal ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Record Supplier Payment (Settlement) --- */}
      {showPaymentModal && payingSupplier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[var(--status-green)]" />
                <h3 className="text-sm font-bold text-[var(--text)]">
                  Record Supplier Settlement: {payingSupplier.name}
                </h3>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Outstanding Balance Payable</p>
                  <p className="text-lg font-black text-[var(--status-red)] mt-0.5">&#2547;{payingSupplier.balance_payable.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Currency & Rate</p>
                  <p className="text-xs font-bold text-[var(--text)] mt-0.5">
                    1 {payingSupplier.currency} = &#2547;{payingSupplier.default_exchange_rate}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Amount in BDT (&#2547;) *</label>
                  <input
                    type="number"
                    required
                    step="1"
                    value={payAmountBdt}
                    onChange={(e) => handlePayBdtChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-bold text-[var(--status-green)] text-base"
                  />
                </div>

                {payingSupplier.currency !== 'BDT' && (
                  <div>
                    <label className="block text-xs font-bold text-[var(--text)] mb-1">Amount in {payingSupplier.currency}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payAmountForeign}
                      onChange={(e) => handlePayForeignChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-bold text-[var(--status-amber)]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Payment Source Account *</label>
                  <select
                    value={payAccountId}
                    onChange={(e) => setPayAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-medium"
                  >
                    {accounts
                      .filter(a => a.type === 'asset')
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} (Balance: &#2547;{a.balance.toLocaleString()})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-medium"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Telegraphic Transfer (TT) / Bank Reference</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="e.g. TT-CB-849201"
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Settlement Notes</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="Air cargo batch settlement, invoice # reference"
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="p-3 bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-teal)_20%,transparent)] rounded-xl text-[11px] text-[var(--status-teal)]">
                Double-entry entry generated: <strong>Dr Dubai Supplier Payables</strong> (&#2547;{payAmountBdt.toLocaleString()}),{' '}
                <strong>Cr Bank / Cash Account</strong> (&#2547;{payAmountBdt.toLocaleString()}).
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--border)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[var(--status-green)] text-white text-xs font-bold rounded-lg hover:opacity-90 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm & Post Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Supplier Statement & Ledger --- */}
      {showStatementModal && statementSupplier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    Supplier Statement of Account: {statementSupplier.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {statementSupplier.country} &#8226; Currency: {statementSupplier.currency} &#8226; Terms: {statementSupplier.payment_terms}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowStatementModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[var(--surface-sunken)] p-3 rounded-xl border border-[var(--border)]">
                  <p className="text-[11px] text-[var(--text-muted)] uppercase font-bold">Total Invoiced (POs)</p>
                  <p className="text-base font-black text-[var(--text)] mt-0.5">
                    &#2547;{((statementData?.purchase_orders || []).reduce((s: number, p: any) => s + p.total_amount_bdt, 0)).toLocaleString()}
                  </p>
                </div>

                <div className="bg-[var(--surface-sunken)] p-3 rounded-xl border border-[var(--border)]">
                  <p className="text-[11px] text-[var(--text-muted)] uppercase font-bold">Total Paid / Settled</p>
                  <p className="text-base font-black text-[var(--status-green)] mt-0.5">
                    &#2547;{((statementData?.payments || []).reduce((s: number, p: any) => s + p.amount_bdt, 0)).toLocaleString()}
                  </p>
                </div>

                <div className="bg-[var(--surface-sunken)] p-3 rounded-xl border border-[var(--border)]">
                  <p className="text-[11px] text-[var(--text-muted)] uppercase font-bold">Current Balance Payable</p>
                  <p className={`text-base font-black mt-0.5 ${statementSupplier.balance_payable > 0 ? 'text-[var(--status-red)]' : 'text-[var(--status-green)]'}`}>
                    &#2547;{statementSupplier.balance_payable.toLocaleString()}
                  </p>
                </div>
              </div>

              {statementLoading ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)]">Loading statement transactions...</div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Transaction Ledger</h4>
                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <table className="dense-table">
                      <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Reference #</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">Debit (Paid/Returned)</th>
                          <th className="py-2.5 px-3 text-right">Credit (Billed PO)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {/* POs */}
                        {(statementData?.purchase_orders || []).map((po: any) => (
                          <tr key={po.id} className="hover:bg-[var(--surface-hover)]">
                            <td className="py-2 px-3 text-[var(--text-muted)]">{po.order_date}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] text-[var(--status-teal)]">
                                Purchase Order
                              </span>
                            </td>
                            <td className="py-2 px-3 font-semibold text-[var(--text)]">{po.po_number}</td>
                            <td className="py-2 px-3 text-[var(--text-muted)]">{po.items?.length} items ({po.status})</td>
                            <td className="py-2 px-3 text-right text-[var(--text-muted)]">&#8212;</td>
                            <td className="py-2 px-3 text-right font-bold text-[var(--text)]">&#2547;{po.total_amount_bdt.toLocaleString()}</td>
                          </tr>
                        ))}

                        {/* Payments */}
                        {(statementData?.payments || []).map((pay: any) => (
                          <tr key={pay.id} className="hover:bg-[var(--surface-hover)] bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)]">
                            <td className="py-2 px-3 text-[var(--text-muted)]">{pay.payment_date}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]">
                                Payment / TT
                              </span>
                            </td>
                            <td className="py-2 px-3 font-semibold text-[var(--status-green)]">{pay.payment_number}</td>
                            <td className="py-2 px-3 text-[var(--text-muted)]">{pay.reference_no} &#8226; {pay.payment_account_name}</td>
                            <td className="py-2 px-3 text-right font-bold text-[var(--status-green)]">&#2547;{pay.amount_bdt.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-[var(--text-muted)]">&#8212;</td>
                          </tr>
                        ))}

                        {/* Returns */}
                        {(statementData?.returns || []).map((ret: any) => (
                          <tr key={ret.id} className="hover:bg-[var(--surface-hover)] bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)]">
                            <td className="py-2 px-3 text-[var(--text-muted)]">{ret.return_date}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] text-[var(--status-amber)]">
                                Return Note
                              </span>
                            </td>
                            <td className="py-2 px-3 font-semibold text-[var(--status-amber)]">{ret.return_number}</td>
                            <td className="py-2 px-3 text-[var(--text-muted)]">{ret.reason} &#8226; {ret.reason_details}</td>
                            <td className="py-2 px-3 text-right font-bold text-[var(--status-amber)]">&#2547;{ret.total_amount_bdt.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-[var(--text-muted)]">&#8212;</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-sunken)] flex items-center justify-end">
              <button
                onClick={() => setShowStatementModal(false)}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--border)] transition-colors cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
