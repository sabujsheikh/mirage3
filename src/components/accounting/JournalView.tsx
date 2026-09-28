import { PageHeader } from '../common/PageHeader';
import React, { useState } from 'react';
import {
  Scale,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Wallet,
  Building2,
  Smartphone,
  CreditCard,
  TrendingUp,
  Coins,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { JournalEntry, Account } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

export const JournalView: React.FC = () => {
  const { journalEntries, accounts, postJournalEntry } = useApp();
  const { can } = useAuth();

  const safeJournalEntries = Array.isArray(journalEntries) ? journalEntries : [];
  const safeAccounts = Array.isArray(accounts) ? accounts : [];

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [accountFilter, setAccountFilter] = useState<string>('all');

  // Manual Journal Entry Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [entryDesc, setEntryDesc] = useState<string>('');
  const [entryRef, setEntryRef] = useState<string>('');
  const [lines, setLines] = useState<
    { account_id: string; debit: number; credit: number; line_desc?: string }[]
  >([
    { account_id: safeAccounts[0]?.id || 'acc_cash', debit: 0, credit: 0 },
    { account_id: safeAccounts[1]?.id || 'acc_sales', debit: 0, credit: 0 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Total sums of debits and credits across all entries (Section 15.0)
  const totalDebits = safeJournalEntries.reduce((sum, e) => sum + e.total_debit, 0);
  const totalCredits = safeJournalEntries.reduce((sum, e) => sum + e.total_credit, 0);
  const isLedgerBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  // Filter entries
  const filteredEntries = safeJournalEntries.filter(entry => {
    if (accountFilter !== 'all') {
      const touchesAcc = (entry.lines || []).some(l => l.account_id === accountFilter);
      if (!touchesAcc) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = (entry.entry_number || '').toLowerCase().includes(q);
      const matchDesc = (entry.description || '').toLowerCase().includes(q);
      const matchRef = (entry.reference_id || '').toLowerCase().includes(q);
      const matchLine = (entry.lines || []).some(
        l => (l.account_name || '').toLowerCase().includes(q) || (l.account_code || '').includes(q)
      );
      if (!matchNum && !matchDesc && !matchRef && !matchLine) return false;
    }
    return true;
  });

  // Calculate modal line sums
  const modalDebits = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const modalCredits = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isModalBalanced = Math.abs(modalDebits - modalCredits) < 0.01 && modalDebits > 0;

  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      { account_id: accounts[0]?.id || 'acc_cash', debit: 0, credit: 0 },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isModalBalanced) {
      setErrorMsg('Total debits must strictly equal total credits before posting.');
      return;
    }
    if (!entryDesc.trim()) {
      setErrorMsg('Please enter a description for the journal entry.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await postJournalEntry({
        date: entryDate,
        description: entryDesc,
        reference_id: entryRef,
        lines: lines.map(l => ({
          account_id: l.account_id,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          line_desc: l.line_desc,
        })),
      });

      setSuccessMsg('Double-entry journal posted successfully.');
      setTimeout(() => {
        setShowAddModal(false);
        setSuccessMsg(null);
        setEntryDesc('');
        setEntryRef('');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Account Money Buckets Row (Section 15.1 & Section 38.1) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {accounts.slice(0, 6).map(acc => {
          const isAsset = acc.type === 'asset';
          const isRev = acc.type === 'revenue';
          return (
            <div
              key={acc.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase font-mono">
                  {acc.code}
                </span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--accent)]/10 text-[var(--accent)]">
                  {acc.type}
                </span>
              </div>
              <div className="text-xs font-bold text-[var(--text)] truncate">{acc.name}</div>
              <div className="font-mono font-bold text-sm text-[var(--accent)]">
                &#2547;{(acc.balance || 0).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Balanced Status & Search Header */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search general ledger by entry #, account name or reference..."
              className="erp-input pl-8 w-64"
            />
          </div>

          <select
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-[var(--border)] rounded-md bg-[var(--card)] text-[var(--text)]"
          >
            <option value="all">All Chart of Accounts</option>
            {safeAccounts.map(a => (
              <option key={a.id} value={a.id}>
                [{a.code}] {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Ledger Balanced Badge & New Entry Button */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
              isLedgerBalanced
                ? 'bg-[var(--status-green)]/10 text-[var(--status-green)] border-[var(--status-green)]/30'
                : 'bg-[var(--status-red)]/10 text-[var(--status-red)] border-[var(--status-red)]/30'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>
              {isLedgerBalanced
                ? `Balanced: \u09F3${totalDebits.toLocaleString()}`
                : `Out of Balance: Dr \u09F3${totalDebits} vs Cr \u09F3${totalCredits}`}
            </span>
          </div>

          {can('manage_accounts') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-md hover:opacity-90 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 text-[var(--accent-secondary)]" />
              <span>Post Journal Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Minimal Balanced 2-Column Debit/Credit View (Section 15.0 & 38) */}
      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-12 text-center text-xs text-[var(--text-secondary)]">
            No journal entries match current search filters.
          </div>
        ) : (
          filteredEntries.map(entry => (
            <div
              key={entry.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xs overflow-hidden"
            >
              {/* Entry Header */}
              <div className="bg-[var(--surface-sunken)] px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[var(--accent)]">
                    {entry.entry_number}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {new Date(entry.date).toLocaleDateString('en-GB')}
                  </span>
                  <span className="font-semibold text-[var(--text)]">
                    {entry.description}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)]">
                  {entry.reference_id && (
                    <span className="font-mono bg-[var(--card)] px-2 py-0.5 rounded border border-[var(--border)]">
                      Ref: {entry.reference_id}
                    </span>
                  )}
                  <span>By: {entry.created_by_name}</span>
                </div>
              </div>

              {/* 2-Column Debit/Credit Breakdown */}
              <table className="dense-table">
                <thead className="text-[10px] text-[var(--text-secondary)] uppercase font-bold bg-[var(--surface-sunken)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-1.5 w-24">Code</th>
                    <th className="px-4 py-1.5">Account</th>
                    <th className="px-4 py-1.5 text-right w-32 text-[var(--status-green)]">Debit</th>
                    <th className="px-4 py-1.5 text-right w-32 text-[var(--accent)]">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/40">
                  {entry.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-[var(--surface-sunken)]/30">
                      <td className="px-4 py-2 font-mono text-[11px] text-[var(--text-secondary)]">
                        {line.account_code}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`font-semibold ${
                            line.credit > 0 ? 'pl-6 text-[var(--text)]' : 'text-[var(--accent)]'
                          }`}
                        >
                          {line.account_name}
                        </span>
                        {line.line_desc && (
                          <span className="text-[11px] text-[var(--text-secondary)] ml-2 italic">
                            ({line.line_desc})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-medium text-[var(--status-green)]">
                        {line.debit > 0 ? `\u09F3${line.debit.toLocaleString()}` : '\u2014'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-medium text-[var(--accent)]">
                        {line.credit > 0 ? `\u09F3${line.credit.toLocaleString()}` : '\u2014'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[var(--surface-sunken)]/60 border-t border-[var(--border)] text-xs font-bold font-mono">
                  <tr>
                    <td colSpan={2} className="px-4 py-1.5 text-right text-[var(--text-secondary)] uppercase text-[10px]">
                      Entry Total:
                    </td>
                    <td className="px-4 py-1.5 text-right text-[var(--status-green)]">
                      &#2547;{entry.total_debit.toLocaleString()}
                    </td>
                    <td className="px-4 py-1.5 text-right text-[var(--accent)]">
                      &#2547;{entry.total_credit.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))
        )}
      </div>

      {/* Manual Journal Entry Modal (Section 15.0) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-[var(--card)] rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-[var(--border)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--accent)]">
                  Post Double-Entry Journal Entry
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text)] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-[var(--status-red)]/10 text-[var(--status-red)] rounded text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-[var(--status-green)]/10 text-[var(--status-green)] rounded text-xs font-semibold">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmitEntry} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full p-2 border border-[var(--border)] rounded text-xs"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                    Transaction Description
                  </label>
                  <input
                    type="text"
                    value={entryDesc}
                    onChange={e => setEntryDesc(e.target.value)}
                    placeholder="e.g. Showroom rent, Influencer marketing payout, Utility bill"
                    className="w-full p-2 border border-[var(--border)] rounded text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Reference # (Voucher, Bill, Cheque)
                </label>
                <input
                  type="text"
                  value={entryRef}
                  onChange={e => setEntryRef(e.target.value)}
                  placeholder="e.g. VOUCHER-9012"
                  className="w-full p-2 border border-[var(--border)] rounded text-xs"
                />
              </div>

              {/* Journal Line Items Table */}
              <div className="border border-[var(--border)] rounded-md overflow-hidden">
                <table className="dense-table">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[10px] text-[var(--text-secondary)] uppercase font-bold">
                    <tr>
                      <th className="p-2">Account</th>
                      <th className="p-2 text-right w-28">Debit (Dr)</th>
                      <th className="p-2 text-right w-28">Credit (Cr)</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <select
                            value={line.account_id}
                            onChange={e =>
                              setLines(prev =>
                                prev.map((l, i) =>
                                  i === idx ? { ...l, account_id: e.target.value } : l
                                )
                              )
                            }
                            className="w-full p-1 border border-[var(--border)] rounded text-xs bg-[var(--card)]"
                          >
                            {safeAccounts.map(a => (
                              <option key={a.id} value={a.id}>
                                [{a.code}] {a.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={line.debit || ''}
                            onChange={e =>
                              setLines(prev =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? { ...l, debit: Number(e.target.value), credit: 0 }
                                    : l
                                )
                              )
                            }
                            placeholder="0.00"
                            className="w-full text-right font-mono p-1 border border-[var(--border)] rounded text-xs"
                          />
                        </td>

                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={line.credit || ''}
                            onChange={e =>
                              setLines(prev =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? { ...l, credit: Number(e.target.value), debit: 0 }
                                    : l
                                )
                              )
                            }
                            placeholder="0.00"
                            className="w-full text-right font-mono p-1 border border-[var(--border)] rounded text-xs"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="text-[var(--status-red)] font-bold p-1 cursor-pointer disabled:opacity-30"
                            disabled={lines.length <= 2}
                          >
                            &#10005;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  + Add Another Account Line
                </button>

                {/* Validation Summary */}
                <div className="text-right text-xs font-mono font-bold">
                  <span className="text-[var(--status-green)]">Dr: &#2547;{modalDebits.toLocaleString()}</span>
                  <span className="mx-2 text-[var(--text-secondary)]">|</span>
                  <span className="text-[var(--accent)]">Cr: &#2547;{modalCredits.toLocaleString()}</span>
                  <span className="ml-3">
                    {isModalBalanced ? (
                      <span className="text-[var(--status-green)]">&#10003; Balanced</span>
                    ) : (
                      <span className="text-[var(--status-red)]">
                        Diff: &#2547;{Math.abs(modalDebits - modalCredits).toLocaleString()}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isModalBalanced || isSubmitting}
                  className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? 'Posting...' : 'Post Journal Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
