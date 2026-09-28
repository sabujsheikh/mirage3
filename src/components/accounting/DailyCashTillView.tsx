import { PageHeader } from '../common/PageHeader';
import React, { useState } from 'react';
import {
  Coins,
  DollarSign,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  User,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Building,
  RefreshCw,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { DailyCashRegisterLog } from '../../types';

export const DailyCashTillView: React.FC = () => {
  const {
    cashRegisterLogs,
    accounts,
    reconcileDailyCashRegister,
    refreshAll,
  } = useApp();
  const { currentUser, can } = useAuth();

  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [openingFloat, setOpeningFloat] = useState<number>(5000);
  const [cashSalesInflow, setCashSalesInflow] = useState<number>(38500);
  const [cashOutflow, setCashOutflow] = useState<number>(2400);
  const [notes, setNotes] = useState('');

  // Physical Denominations
  const [denom1000, setDenom1000] = useState<number>(30);
  const [denom500, setDenom500] = useState<number>(18);
  const [denom200, setDenom200] = useState<number>(8);
  const [denom100, setDenom100] = useState<number>(10);
  const [denom50, setDenom50] = useState<number>(0);
  const [denom20, setDenom20] = useState<number>(0);
  const [denom10, setDenom10] = useState<number>(0);
  const [denomCoins, setDenomCoins] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const safeLogs = Array.isArray(cashRegisterLogs) ? cashRegisterLogs : [];

  const cashAccount = safeAccounts.find((a) => a.id === 'acc_cash');
  const cashBalance = cashAccount ? cashAccount.balance : 0;

  // Calculated count
  const actualCount =
    denom1000 * 1000 +
    denom500 * 500 +
    denom200 * 200 +
    denom100 * 100 +
    denom50 * 50 +
    denom20 * 20 +
    denom10 * 10 +
    denomCoins;

  const expectedClosingCash = openingFloat + cashSalesInflow - cashOutflow;
  const variance = actualCount - expectedClosingCash;

  const handleSubmitReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await reconcileDailyCashRegister({
        session_date: sessionDate,
        opening_float: Number(openingFloat),
        cash_sales_inflow: Number(cashSalesInflow),
        cash_outflow: Number(cashOutflow),
        denominations: {
          note_1000: Number(denom1000),
          note_500: Number(denom500),
          note_200: Number(denom200),
          note_100: Number(denom100),
          note_50: Number(denom50),
          note_20: Number(denom20),
          note_10: Number(denom10),
          coins: Number(denomCoins),
        },
        notes,
      });

      setSuccessMsg(`Successfully reconciled daily cash till for ${sessionDate}.`);
      setShowReconcileModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reconcile daily cash register');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" id="daily-cash-till-view">
      {/* Top Header */}
      <PageHeader
        eyebrow="Accounting"
        title="Daily Cash Till"
        desc="Physical showroom cash drawer balancing, denomination counting & cash register logs"
        actions={
          can('manage_accounts') ? (
            <button
              onClick={() => setShowReconcileModal(true)}
              className="erp-btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Reconcile Daily Till</span>
            </button>
          ) : undefined
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Cash in Hand (Till Ledger)</span>
            <Coins className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text)]">&#2547;{cashBalance.toLocaleString()}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Account code: 1010</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Last Reconciled Date</span>
            <Calendar className="w-4 h-4 text-[var(--status-teal)]" />
          </div>
          <div className="text-xl font-bold text-[var(--text)]">
            {cashRegisterLogs[0]?.session_date || 'None'}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Status: {cashRegisterLogs[0]?.variance === 0 ? 'Exact Match (\u09F30)' : `Variance \u09F3${cashRegisterLogs[0]?.variance || 0}`}
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Total Sessions Logged</span>
            <FileText className="w-4 h-4 text-[var(--status-green)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-green)]">{cashRegisterLogs.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Historical till balancing logs</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Total Cash Shortage Loss</span>
            <AlertTriangle className="w-4 h-4 text-[var(--status-red)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-red)]">
            &#2547;
            {Math.abs(
              cashRegisterLogs.reduce((sum, l) => sum + (l.variance < 0 ? l.variance : 0), 0)
            ).toLocaleString()}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Dr Cash Shortage Expense (6100)</div>
        </div>
      </div>

      {/* Historical Cash Till Logs Table */}
      <div className="dense-table-container">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
            <Coins className="w-4 h-4 text-[var(--accent)]" />
            Cash Register Reconciliation Audit Ledger
          </h3>
          <span className="text-xs text-[var(--text-muted)]">{cashRegisterLogs.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="dense-table">
            <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Session Date</th>
                <th className="py-3 px-4 text-right">Opening Float</th>
                <th className="py-3 px-4 text-right">Sales Inflows</th>
                <th className="py-3 px-4 text-right">Petty Outflows</th>
                <th className="py-3 px-4 text-right">Expected Cash</th>
                <th className="py-3 px-4 text-right">Actual Count</th>
                <th className="py-3 px-4 text-center">Variance</th>
                <th className="py-3 px-4">Closed By & Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {safeLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-[var(--text-muted)]">
                    No cash register logs recorded yet.
                  </td>
                </tr>
              ) : (
                safeLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="py-3 px-4 font-bold text-[var(--text)] font-mono">
                      {log.session_date}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-[var(--text)]">
                      &#2547;{log.opening_float.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-[var(--status-green)] font-bold">
                      +&#2547;{log.cash_sales_inflow.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-[var(--status-red)]">
                      -&#2547;{log.cash_outflow.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-[var(--text)]">
                      &#2547;{log.expected_closing_cash.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-black text-[var(--accent)]">
                      &#2547;{log.actual_cash_count.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-center font-mono">
                      {log.variance === 0 ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]">
                          BALANCED (&#2547;0)
                        </span>
                      ) : log.variance < 0 ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)]">
                          SHORTAGE (&#2547;{Math.abs(log.variance).toLocaleString()})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] text-[var(--status-teal)]">
                          OVERAGE (+&#2547;{log.variance.toLocaleString()})
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-[var(--text)]">{log.closed_by_name}</div>
                      {log.notes && <div className="text-[11px] text-[var(--text-muted)] truncate max-w-xs">{log.notes}</div>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL: Reconcile Cash Till --- */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">End-of-Day Cash Till Reconciliation</h3>
                  <p className="text-xs text-[var(--text-muted)]">Count physical notes and balance showroom till register</p>
                </div>
              </div>
              <button onClick={() => setShowReconcileModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReconciliation} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)]">
                  {errorMsg}
                </div>
              )}

              {/* Date and Cash Flow Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Session Date</label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Opening Float (&#2547;)</label>
                  <input
                    type="number"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Cash Inflows (&#2547;)</label>
                  <input
                    type="number"
                    value={cashSalesInflow}
                    onChange={(e) => setCashSalesInflow(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--status-green)] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Petty Outflows (&#2547;)</label>
                  <input
                    type="number"
                    value={cashOutflow}
                    onChange={(e) => setCashOutflow(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--status-red)] font-mono font-bold"
                  />
                </div>
              </div>

              {/* Physical Denominations Counter (Section 17.0) */}
              <div className="space-y-2">
                <h4 className="font-bold text-[var(--text)] uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Physical Banknote Denomination Count</span>
                  <span className="font-mono text-[var(--accent)] font-bold text-xs">
                    Counted Total: &#2547;{actualCount.toLocaleString()}
                  </span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">&#2547;1,000 Notes</label>
                    <input
                      type="number"
                      min="0"
                      value={denom1000}
                      onChange={(e) => setDenom1000(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-sunken)] font-mono font-bold text-right"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] block text-right font-mono mt-0.5">
                      = &#2547;{(denom1000 * 1000).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">&#2547;500 Notes</label>
                    <input
                      type="number"
                      min="0"
                      value={denom500}
                      onChange={(e) => setDenom500(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-sunken)] font-mono font-bold text-right"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] block text-right font-mono mt-0.5">
                      = &#2547;{(denom500 * 500).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">&#2547;200 Notes</label>
                    <input
                      type="number"
                      min="0"
                      value={denom200}
                      onChange={(e) => setDenom200(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-sunken)] font-mono font-bold text-right"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] block text-right font-mono mt-0.5">
                      = &#2547;{(denom200 * 200).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">&#2547;100 Notes</label>
                    <input
                      type="number"
                      min="0"
                      value={denom100}
                      onChange={(e) => setDenom100(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-sunken)] font-mono font-bold text-right"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] block text-right font-mono mt-0.5">
                      = &#2547;{(denom100 * 100).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">&#2547;50 Notes</label>
                    <input
                      type="number"
                      min="0"
                      value={denom50}
                      onChange={(e) => setDenom50(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-sunken)] font-mono font-bold text-right"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] block text-right font-mono mt-0.5">
                      = &#2547;{(denom50 * 50).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">&#2547;20 Notes</label>
                    <input
                      type="number"
                      min="0"
                      value={denom20}
                      onChange={(e) => setDenom20(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-sunken)] font-mono font-bold text-right"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] block text-right font-mono mt-0.5">
                      = &#2547;{(denom20 * 20).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">&#2547;10 Notes</label>
                    <input
                      type="number"
                      min="0"
                      value={denom10}
                      onChange={(e) => setDenom10(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-sunken)] font-mono font-bold text-right"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] block text-right font-mono mt-0.5">
                      = &#2547;{(denom10 * 10).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">Coins / Change</label>
                    <input
                      type="number"
                      min="0"
                      value={denomCoins}
                      onChange={(e) => setDenomCoins(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-sunken)] font-mono font-bold text-right"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] block text-right font-mono mt-0.5">
                      = &#2547;{denomCoins.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Variance Indicator */}
              <div className="p-4 rounded-xl border flex items-center justify-between bg-[var(--surface-sunken)] border-[var(--border)]">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Reconciliation Status</span>
                  <div className="text-sm font-bold mt-0.5">
                    Expected: <span className="font-mono">&#2547;{expectedClosingCash.toLocaleString()}</span> &#8226; Counted: <span className="font-mono text-[var(--accent)]">&#2547;{actualCount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Till Variance</span>
                  <div className={`text-base font-black ${variance === 0 ? 'text-[var(--status-green)]' : variance < 0 ? 'text-[var(--status-red)]' : 'text-[var(--status-teal)]'}`}>
                    {variance === 0 ? 'BALANCED (\u09F30)' : variance < 0 ? `-\u09F3${Math.abs(variance).toLocaleString()} (Shortage)` : `+\u09F3${variance.toLocaleString()} (Overage)`}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Closing Inspection Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Till balanced with drawer key locked in safe..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting Journal...' : 'Confirm Till Close & Post Journal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
