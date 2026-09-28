import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  Truck, 
  Building2, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  DollarSign, 
  FileText,
  ShieldCheck,
  Check,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { CourierBookingsView } from '../courier/CourierBookingsView';
import { CourierSettlementBatchesTab } from '../courier/CourierSettlementBatchesTab';
import { PageHeader } from '../common/PageHeader';

interface ReconciliationData {
  summary: any;
  bookings: any[];
  bank_accounts: Array<{ id: string; code: string; name: string; type: string; balance: number }>;
  bank_transactions: Array<{
    id: string;
    journal_id: string;
    entry_number: string;
    date: string;
    description: string;
    account_id: string;
    debit: number;
    credit: number;
    reference_id?: string;
  }>;
  mfs_transactions: Array<{
    id: string;
    journal_id: string;
    entry_number: string;
    date: string;
    description: string;
    account_id: string;
    debit: number;
    credit: number;
    reference_id?: string;
  }>;
}

export const ReconciliationView: React.FC = () => {
  const { accounts, refreshAll } = useApp();
  const { sessionToken, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'courier' | 'settlement_batches' | 'bank' | 'mfs'>('courier');
  const [loading, setLoading] = useState(false);
  const [reconData, setReconData] = useState<ReconciliationData | null>(null);

  const getAuthHeaders = () => {
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
  };

  // Bank reconciliation state
  const [selectedBankAccId, setSelectedBankAccId] = useState('acc_bank');
  const [bankStatementDate, setBankStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [bankStatementBalance, setBankStatementBalance] = useState('');
  const [bankCharges, setBankCharges] = useState('');
  const [bankNotes, setBankNotes] = useState('');
  const [clearedBankTxnIds, setClearedBankTxnIds] = useState<Set<string>>(new Set());
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bankSuccessMsg, setBankSuccessMsg] = useState('');

  // MFS reconciliation state
  const [selectedMfsAccId, setSelectedMfsAccId] = useState('acc_bkash');
  const [mfsStatementDate, setMfsStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [mfsStatementBalance, setMfsStatementBalance] = useState('');
  const [mfsCashoutFees, setMfsCashoutFees] = useState('');
  const [mfsNotes, setMfsNotes] = useState('');
  const [clearedMfsTxnIds, setClearedMfsTxnIds] = useState<Set<string>>(new Set());
  const [mfsSubmitting, setMfsSubmitting] = useState(false);
  const [mfsSuccessMsg, setMfsSuccessMsg] = useState('');

  const fetchReconciliationData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/accounting/reconciliation', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setReconData(data);
      }
    } catch (err) {
      console.error('Failed to load reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliationData();
  }, [sessionToken]);

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBankSubmitting(true);
      const res = await fetch('/api/accounting/reconcile-bank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          account_id: selectedBankAccId,
          statement_date: bankStatementDate,
          statement_balance: Number(bankStatementBalance) || 0,
          bank_charges: Number(bankCharges) || 0,
          notes: bankNotes,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setBankSuccessMsg(json.message);
        setBankCharges('');
        setBankNotes('');
        await fetchReconciliationData();
        await refreshAll();
        setTimeout(() => setBankSuccessMsg(''), 5000);
      } else {
        alert(json.error || 'Bank reconciliation failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setBankSubmitting(false);
    }
  };

  const handleMfsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMfsSubmitting(true);
      const res = await fetch('/api/accounting/reconcile-mfs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          account_id: selectedMfsAccId,
          statement_date: mfsStatementDate,
          statement_balance: Number(mfsStatementBalance) || 0,
          cashout_fees: Number(mfsCashoutFees) || 0,
          notes: mfsNotes,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMfsSuccessMsg(json.message);
        setMfsCashoutFees('');
        setMfsNotes('');
        await fetchReconciliationData();
        await refreshAll();
        setTimeout(() => setMfsSuccessMsg(''), 5000);
      } else {
        alert(json.error || 'MFS reconciliation failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setMfsSubmitting(false);
    }
  };

  const toggleBankTxn = (id: string) => {
    setClearedBankTxnIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMfsTxn = (id: string) => {
    setClearedMfsTxnIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const selectedBankAcc = safeAccounts.find(a => a.id === selectedBankAccId) || safeAccounts.find(a => a.id === 'acc_bank');
  const filteredBankTxns = (reconData?.bank_transactions || []).filter(t => t.account_id === selectedBankAccId);

  const selectedMfsAcc = safeAccounts.find(a => a.id === selectedMfsAccId) || safeAccounts.find(a => a.id === 'acc_bkash');
  const filteredMfsTxns = (reconData?.mfs_transactions || []).filter(t => t.account_id === selectedMfsAccId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        eyebrow="Accounting & Finance"
        title="Financial Reconciliation"
        desc="Reconcile Steadfast Courier COD payouts, Bank statements, and bKash / Nagad mobile financial service wallets against double-entry general ledger records."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchReconciliationData();
                refreshAll();
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sync Balances
            </button>
          </div>
        }
      />

      {/* Sub-Tabs: Courier / Bank / MFS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('courier')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'courier'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          Courier COD (Steadfast)
        </button>
        <button
          onClick={() => setActiveTab('settlement_batches')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'settlement_batches'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Weekly Settlement Batches
        </button>
        <button
          onClick={() => setActiveTab('bank')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'bank'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Bank Statements
        </button>
        <button
          onClick={() => setActiveTab('mfs')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'mfs'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          MFS Wallets (bKash & Nagad)
        </button>
      </div>

      {/* Tab 1: Courier Reconciliation */}
      {activeTab === 'courier' && (
        <div className="pt-2">
          <CourierBookingsView />
        </div>
      )}

      {/* Tab: Courier Settlement Batches */}
      {activeTab === 'settlement_batches' && (
        <div className="pt-2">
          <CourierSettlementBatchesTab />
        </div>
      )}

      {/* Tab 2: Bank Statement Reconciliation */}
      {activeTab === 'bank' && (
        <div className="space-y-6">
          {bankSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium">{bankSuccessMsg}</span>
            </div>
          )}

          {/* Bank Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <span>Active Bank Account</span>
                <Building2 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {selectedBankAcc?.name || 'City Bank Account'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                GL Code: {selectedBankAcc?.code || '1020'}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <span>System GL Book Balance</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ৳{(selectedBankAcc?.balance || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Current double-entry ledger balance
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <span>Target Statement Balance</span>
                <Scale className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                ৳{bankStatementBalance ? Number(bankStatementBalance).toLocaleString() : '—'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {bankStatementBalance ? (
                  Math.abs((selectedBankAcc?.balance || 0) - Number(bankStatementBalance)) < 1 ? (
                    <span className="text-emerald-600 font-medium">Balances match perfectly</span>
                  ) : (
                    <span className="text-amber-600 font-medium">
                      Variance: ৳{((selectedBankAcc?.balance || 0) - Number(bankStatementBalance)).toLocaleString()}
                    </span>
                  )
                ) : (
                  'Enter ending balance from bank statement'
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Reconciliation Form */}
            <div className="lg:col-span-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                Bank Statement Details
              </h3>
              <form onSubmit={handleBankSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Select Bank Account
                  </label>
                  <select
                    value={selectedBankAccId}
                    onChange={e => setSelectedBankAccId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="acc_bank">City Bank Account (1020)</option>
                    <option value="acc_bank_personal">Personal Bank Account (1021)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Statement Ending Date
                  </label>
                  <input
                    type="date"
                    value={bankStatementDate}
                    onChange={e => setBankStatementDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Statement Ending Balance (৳)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 350000"
                    value={bankStatementBalance}
                    onChange={e => setBankStatementBalance(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Bank Service / Maintenance Charges (৳)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={bankCharges}
                    onChange={e => setBankCharges(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-0.5">Posts Dr Office Expense, Cr Bank Account</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Reconciliation Notes / Reference
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Monthly statement reconciliation verified with City Bank online banking."
                    value={bankNotes}
                    onChange={e => setBankNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={bankSubmitting}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {bankSubmitting ? 'Posting Reconciliation...' : 'Finalize Bank Reconciliation'}
                </button>
              </form>
            </div>

            {/* Transactions Matching Table */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  General Ledger Transactions ({filteredBankTxns.length})
                </h3>
                <span className="text-xs text-slate-500">
                  {clearedBankTxnIds.size} transaction(s) marked cleared
                </span>
              </div>

              <div className="overflow-x-auto max-h-[440px] border border-slate-100 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase">
                    <tr>
                      <th className="p-2.5 w-8">Clear</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Entry #</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-right">Debit (In)</th>
                      <th className="p-2.5 text-right">Credit (Out)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredBankTxns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          No ledger transactions recorded for this bank account yet.
                        </td>
                      </tr>
                    ) : (
                      filteredBankTxns.map(t => {
                        const isCleared = clearedBankTxnIds.has(t.id);
                        return (
                          <tr
                            key={t.id}
                            onClick={() => toggleBankTxn(t.id)}
                            className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                              isCleared ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                            }`}
                          >
                            <td className="p-2.5">
                              <input
                                type="checkbox"
                                checked={isCleared}
                                onChange={() => {}}
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                              />
                            </td>
                            <td className="p-2.5 whitespace-nowrap text-slate-500">{t.date}</td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-500">{t.entry_number}</td>
                            <td className="p-2.5 max-w-xs truncate">{t.description}</td>
                            <td className="p-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400">
                              {t.debit > 0 ? `+৳${t.debit.toLocaleString()}` : '—'}
                            </td>
                            <td className="p-2.5 text-right font-medium text-rose-600 dark:text-rose-400">
                              {t.credit > 0 ? `-৳${t.credit.toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: MFS Reconciliation (bKash & Nagad) */}
      {activeTab === 'mfs' && (
        <div className="space-y-6">
          {mfsSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium">{mfsSuccessMsg}</span>
            </div>
          )}

          {/* MFS Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <span>Selected MFS Wallet</span>
                <Smartphone className="w-4 h-4 text-pink-500" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {selectedMfsAcc?.name || 'bKash Merchant Wallet'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                GL Code: {selectedMfsAcc?.code || '1030'}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <span>System Book Balance</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ৳{(selectedMfsAcc?.balance || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Recorded sales & collections balance
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <span>Merchant Statement Balance</span>
                <Scale className="w-4 h-4 text-pink-500" />
              </div>
              <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                ৳{mfsStatementBalance ? Number(mfsStatementBalance).toLocaleString() : '—'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {mfsStatementBalance ? (
                  Math.abs((selectedMfsAcc?.balance || 0) - Number(mfsStatementBalance)) < 1 ? (
                    <span className="text-emerald-600 font-medium">Balances match perfectly</span>
                  ) : (
                    <span className="text-amber-600 font-medium">
                      Variance: ৳{((selectedMfsAcc?.balance || 0) - Number(mfsStatementBalance)).toLocaleString()}
                    </span>
                  )
                ) : (
                  'Enter ending balance from merchant statement'
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Reconciliation Form */}
            <div className="lg:col-span-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-pink-500" />
                MFS Wallet Reconciliation
              </h3>
              <form onSubmit={handleMfsSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Select MFS Wallet
                  </label>
                  <select
                    value={selectedMfsAccId}
                    onChange={e => setSelectedMfsAccId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="acc_bkash">bKash Merchant Wallet (1030)</option>
                    <option value="acc_nagad">Nagad Merchant Wallet (1040)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Reconciliation Date
                  </label>
                  <input
                    type="date"
                    value={mfsStatementDate}
                    onChange={e => setMfsStatementDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Merchant Wallet Statement Balance (৳)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 82500"
                    value={mfsStatementBalance}
                    onChange={e => setMfsStatementBalance(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cashout / Payment Gateway Fees (৳)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={mfsCashoutFees}
                    onChange={e => setMfsCashoutFees(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-0.5">Posts Dr Office Expense, Cr MFS Wallet</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Reconciliation Notes / Reference
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Daily bKash merchant statement verified with merchant dashboard."
                    value={mfsNotes}
                    onChange={e => setMfsNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={mfsSubmitting}
                  className="w-full py-2.5 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {mfsSubmitting ? 'Posting Reconciliation...' : 'Finalize MFS Reconciliation'}
                </button>
              </form>
            </div>

            {/* MFS Transactions Table */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  MFS Ledger Transactions ({filteredMfsTxns.length})
                </h3>
                <span className="text-xs text-slate-500">
                  {clearedMfsTxnIds.size} transaction(s) marked cleared
                </span>
              </div>

              <div className="overflow-x-auto max-h-[440px] border border-slate-100 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase">
                    <tr>
                      <th className="p-2.5 w-8">Clear</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Entry #</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-right">Debit (In)</th>
                      <th className="p-2.5 text-right">Credit (Out)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredMfsTxns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          No ledger transactions recorded for this MFS wallet yet.
                        </td>
                      </tr>
                    ) : (
                      filteredMfsTxns.map(t => {
                        const isCleared = clearedMfsTxnIds.has(t.id);
                        return (
                          <tr
                            key={t.id}
                            onClick={() => toggleMfsTxn(t.id)}
                            className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                              isCleared ? 'bg-pink-50/40 dark:bg-pink-950/20' : ''
                            }`}
                          >
                            <td className="p-2.5">
                              <input
                                type="checkbox"
                                checked={isCleared}
                                onChange={() => {}}
                                className="rounded text-pink-600 focus:ring-pink-500 h-3.5 w-3.5"
                              />
                            </td>
                            <td className="p-2.5 whitespace-nowrap text-slate-500">{t.date}</td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-500">{t.entry_number}</td>
                            <td className="p-2.5 max-w-xs truncate">{t.description}</td>
                            <td className="p-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400">
                              {t.debit > 0 ? `+৳${t.debit.toLocaleString()}` : '—'}
                            </td>
                            <td className="p-2.5 text-right font-medium text-rose-600 dark:text-rose-400">
                              {t.credit > 0 ? `-৳${t.credit.toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
