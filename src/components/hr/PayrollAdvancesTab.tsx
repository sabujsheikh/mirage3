import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  Edit2,
  Sliders,
  CreditCard,
  Plus,
  ArrowRight,
  TrendingUp,
  X,
  RefreshCw,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface PayrollAdvancesTabProps {
  employees: any[];
  salaryAdvances: any[];
  paymentAccounts: any[];
  onCalculatePayroll: (month: string) => Promise<any[]>;
  onOverridePayrollLine: (data: any) => Promise<void>;
  onFinalizePayroll: (month: string, paymentAccountId: string, notes?: string) => Promise<void>;
  onRequestAdvance: (data: any) => Promise<void>;
  onDisburseAdvance: (advanceId: string, paymentAccountId: string, paymentDate: string) => Promise<void>;
}

export const PayrollAdvancesTab: React.FC<PayrollAdvancesTabProps> = ({
  employees,
  salaryAdvances,
  paymentAccounts,
  onCalculatePayroll,
  onOverridePayrollLine,
  onFinalizePayroll,
  onRequestAdvance,
  onDisburseAdvance,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'payroll' | 'advances'>('payroll');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollLines, setPayrollLines] = useState<any[]>([]);
  const [loadingPayroll, setLoadingPayroll] = useState(false);

  // Modals
  const [viewingPayslip, setViewingPayslip] = useState<any | null>(null);
  const [editingLine, setEditingLine] = useState<any | null>(null);
  const [overrideForm, setOverrideForm] = useState({
    bonus_commission: 0,
    extra_deductions: 0,
    override_reason: '',
  });

  // Finalize Batch Modal
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [disbursementAccount, setDisbursementAccount] = useState('acc_cash');
  const [finalizeNotes, setFinalizeNotes] = useState('');

  // Advances Modals
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    employee_id: employees[0]?.id || '',
    amount: 5000,
    monthly_deduction_amount: 2500,
    reason: '',
  });

  const [disbursingAdv, setDisbursingAdv] = useState<any | null>(null);
  const [disburseAccount, setDisburseAccount] = useState('acc_cash');
  const [disburseDate, setDisburseDate] = useState(new Date().toISOString().slice(0, 10));

  const loadPayroll = async () => {
    try {
      setLoadingPayroll(true);
      const lines = await onCalculatePayroll(selectedMonth);
      setPayrollLines(lines);
    } catch (err: any) {
      alert(err.message || 'Failed to calculate monthly payroll');
    } finally {
      setLoadingPayroll(false);
    }
  };

  useEffect(() => {
    loadPayroll();
  }, [selectedMonth]);

  const handleOpenOverride = (line: any) => {
    setEditingLine(line);
    setOverrideForm({
      bonus_commission: line.bonus_commission || 0,
      extra_deductions: line.extra_deductions || 0,
      override_reason: line.override_reason || '',
    });
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideForm.override_reason) {
      alert('Mandatory override reason required (audit trail logged).');
      return;
    }
    try {
      await onOverridePayrollLine({
        payroll_month: selectedMonth,
        employee_id: editingLine.employee_id,
        bonus_commission: overrideForm.bonus_commission,
        extra_deductions: overrideForm.extra_deductions,
        override_reason: overrideForm.override_reason,
      });
      setEditingLine(null);
      await loadPayroll();
    } catch (err: any) {
      alert(err.message || 'Override failed');
    }
  };

  const handleFinalizeBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onFinalizePayroll(selectedMonth, disbursementAccount, finalizeNotes);
      setShowFinalizeModal(false);
      await loadPayroll();
      alert(`Payroll for ${selectedMonth} finalized and accounting journals posted!`);
    } catch (err: any) {
      alert(err.message || 'Finalization failed');
    }
  };

  const handleRequestAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceForm.reason) {
      alert('Reason is required for salary advance request.');
      return;
    }
    try {
      await onRequestAdvance(advanceForm);
      setShowAdvanceModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to submit advance request');
    }
  };

  const handleDisburseAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disbursingAdv) return;
    try {
      await onDisburseAdvance(disbursingAdv.id, disburseAccount, disburseDate);
      setDisbursingAdv(null);
      alert('Advance disbursed and posted to accounting journal!');
      await loadPayroll();
    } catch (err: any) {
      alert(err.message || 'Disbursement failed');
    }
  };

  const totalGross = payrollLines.reduce((acc, l) => acc + (l.gross_salary || 0), 0);
  const totalDeductions = payrollLines.reduce((acc, l) => acc + (l.total_deductions || 0), 0);
  const totalNet = payrollLines.reduce((acc, l) => acc + (l.net_salary || 0), 0);

  return (
    <div className="space-y-6">
      {/* Subtab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('payroll')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'payroll'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Automated Monthly Payroll
          </button>
          <button
            onClick={() => setActiveSubTab('advances')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'advances'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span>Salary Advances & Loans</span>
            {salaryAdvances.filter(a => a.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-500 text-white text-[10px]">
                {salaryAdvances.filter(a => a.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'payroll' ? (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-500 font-semibold">Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="px-2.5 py-1.5 rounded border border-stone-300 font-medium"
                />
              </div>
              <button
                onClick={loadPayroll}
                title="Recalculate with live attendance & advances"
                className="p-1.5 text-stone-600 hover:text-stone-900 border border-stone-300 rounded hover:bg-stone-50"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowFinalizeModal(true)}
                disabled={payrollLines.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                <DollarSign className="w-4 h-4" /> Finalize & Post Batch
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAdvanceModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Request Salary Advance
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'payroll' ? (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-xs text-stone-500 font-semibold uppercase">Total Gross Salary</span>
              <div className="text-xl font-bold text-stone-900 mt-1">৳{totalGross.toLocaleString()}</div>
              <div className="text-[11px] text-stone-400">Base + Allowances + Bonuses</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-xs text-stone-500 font-semibold uppercase">Total Deductions</span>
              <div className="text-xl font-bold text-rose-600 mt-1">৳{totalDeductions.toLocaleString()}</div>
              <div className="text-[11px] text-stone-400">Advances, Tax, Absences</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-xs text-stone-500 font-semibold uppercase">Net Disbursement Payable</span>
              <div className="text-xl font-bold text-emerald-700 mt-1">৳{totalNet.toLocaleString()}</div>
              <div className="text-[11px] text-stone-400">{payrollLines.length} employees included</div>
            </div>
          </div>

          {/* Payroll Lines Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Base Salary</th>
                    <th className="py-3 px-4">Days (Worked / Unpaid)</th>
                    <th className="py-3 px-4">Bonus / Commission</th>
                    <th className="py-3 px-4">Advance Deducted</th>
                    <th className="py-3 px-4">Net Salary</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loadingPayroll ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-400">
                        Calculating monthly payroll lines from live attendance and policies...
                      </td>
                    </tr>
                  ) : payrollLines.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-400">
                        No payroll lines available for this month.
                      </td>
                    </tr>
                  ) : (
                    payrollLines.map(line => (
                      <tr key={line.id} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4">
                          <div className="font-bold text-stone-900">{line.employee_name}</div>
                          <div className="text-[10px] text-stone-400">{line.designation || 'Staff'}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-900">
                          ৳{(line.base_salary || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-stone-800">{line.worked_days}</span> / {line.working_days}
                          {line.unpaid_leave_days > 0 && (
                            <span className="text-[10px] text-rose-600 block">(-{line.unpaid_leave_days} unpaid)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-emerald-700">
                          ৳{(line.bonus_commission || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-semibold text-rose-700">
                          ৳{(line.advance_deduction || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-stone-900 text-sm">
                          ৳{(line.net_salary || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              line.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {line.status ? line.status.toUpperCase() : 'CALCULATED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleOpenOverride(line)}
                            title="Manual Line Override"
                            className="p-1 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setViewingPayslip(line)}
                            title="View Payslip"
                            className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Advances Subtab */
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Request Date</th>
                  <th className="py-3 px-4">Advance Amount</th>
                  <th className="py-3 px-4">Monthly Deduction</th>
                  <th className="py-3 px-4">Balance Remaining</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {salaryAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-stone-400">
                      No salary advance records on file.
                    </td>
                  </tr>
                ) : (
                  salaryAdvances.map(adv => (
                    <tr key={adv.id} className="hover:bg-stone-50/70">
                      <td className="py-3 px-4 font-bold text-stone-900">{adv.employee_name}</td>
                      <td className="py-3 px-4 text-stone-600">{adv.request_date}</td>
                      <td className="py-3 px-4 font-bold text-stone-900">৳{adv.amount.toLocaleString()}</td>
                      <td className="py-3 px-4 font-semibold text-stone-800">
                        ৳{adv.monthly_deduction_amount.toLocaleString()}/mo
                      </td>
                      <td className="py-3 px-4 font-bold text-purple-700">
                        ৳{adv.remaining_amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-stone-600 max-w-xs truncate">{adv.reason}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            adv.status === 'disbursed'
                              ? 'bg-blue-100 text-blue-800'
                              : adv.status === 'fully_repaid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {adv.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {adv.status === 'pending' && (
                          <button
                            onClick={() => setDisbursingAdv(adv)}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold"
                          >
                            Disburse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payslip Viewer Modal */}
      {viewingPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-stone-200 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-stone-900">Payslip for {viewingPayslip.employee_name}</h3>
                <div className="text-stone-500 text-[11px]">Period: {viewingPayslip.payroll_month || selectedMonth}</div>
              </div>
              <button onClick={() => setViewingPayslip(null)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between border-b border-stone-100 pb-2">
                <span className="text-stone-600">Base Monthly Salary:</span>
                <span className="font-bold text-stone-900">৳{viewingPayslip.base_salary?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-stone-100 pb-2">
                <span className="text-stone-600">Working Days / Present:</span>
                <span className="font-semibold text-stone-800">
                  {viewingPayslip.worked_days} of {viewingPayslip.working_days} days
                </span>
              </div>
              <div className="flex justify-between border-b border-stone-100 pb-2">
                <span className="text-stone-600">Bonus & Commission:</span>
                <span className="font-semibold text-emerald-700">+৳{viewingPayslip.bonus_commission?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-stone-100 pb-2">
                <span className="text-stone-600">Salary Advance Deduction:</span>
                <span className="font-semibold text-rose-600">-৳{viewingPayslip.advance_deduction?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-stone-100 pb-2">
                <span className="text-stone-600">Absence Deductions:</span>
                <span className="font-semibold text-rose-600">-৳{viewingPayslip.absent_deduction?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-bold bg-stone-50 p-3 rounded-lg">
                <span className="text-stone-900">Net Disbursement:</span>
                <span className="text-emerald-700">৳{viewingPayslip.net_salary?.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-stone-200">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded font-bold hover:bg-stone-800"
              >
                <Printer className="w-4 h-4" /> Print Payslip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Override Modal */}
      {editingLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">
                Override Payroll: {editingLine.employee_name}
              </h3>
              <button onClick={() => setEditingLine(null)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveOverride} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Bonus / Commission (৳)</label>
                <input
                  type="number"
                  min={0}
                  value={overrideForm.bonus_commission}
                  onChange={e => setOverrideForm({ ...overrideForm, bonus_commission: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Extra Deductions (৳)</label>
                <input
                  type="number"
                  min={0}
                  value={overrideForm.extra_deductions}
                  onChange={e => setOverrideForm({ ...overrideForm, extra_deductions: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Mandatory Override Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="State reason for manual line adjustment (audit trail logged)..."
                  value={overrideForm.override_reason}
                  onChange={e => setOverrideForm({ ...overrideForm, override_reason: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingLine(null)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Finalize Batch Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Finalize & Disburse Payroll ({selectedMonth})</h3>
              <button onClick={() => setShowFinalizeModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFinalizeBatch} className="p-5 space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900">
                <p className="font-semibold">Real Accounting Journal Integration:</p>
                <p className="text-[11px] mt-1">
                  Finalizing will record an immutable transaction in the ERP General Ledger, debiting Salary
                  Expense and crediting the chosen disbursement account for ৳{totalNet.toLocaleString()}.
                </p>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Disbursement Payment Account *</label>
                <select
                  value={disbursementAccount}
                  onChange={e => setDisbursementAccount(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  {paymentAccounts.length > 0 ? (
                    paymentAccounts.map((acc: any) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Bal: ৳{(acc.balance || 0).toLocaleString()})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="acc_cash">Cash Register (Main Till)</option>
                      <option value="acc_bank">City Bank Corporate A/C</option>
                      <option value="acc_bkash">bKash Merchant Account</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Disbursement Remarks</label>
                <input
                  type="text"
                  placeholder={`Salary batch payment for ${selectedMonth}`}
                  value={finalizeNotes}
                  onChange={e => setFinalizeNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowFinalizeModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-700 text-white rounded font-bold hover:bg-emerald-600">
                  Confirm & Post Journal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Request Salary Advance / Loan</h3>
              <button onClick={() => setShowAdvanceModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRequestAdvance} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Employee *</label>
                <select
                  value={advanceForm.employee_id}
                  onChange={e => setAdvanceForm({ ...advanceForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Requested Amount (৳) *</label>
                <input
                  type="number"
                  min={500}
                  required
                  value={advanceForm.amount}
                  onChange={e => setAdvanceForm({ ...advanceForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Monthly Deduction Repayment (৳) *</label>
                <input
                  type="number"
                  min={500}
                  required
                  value={advanceForm.monthly_deduction_amount}
                  onChange={e => setAdvanceForm({ ...advanceForm, monthly_deduction_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Reason for Advance *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain necessity..."
                  value={advanceForm.reason}
                  onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disburse Advance Modal */}
      {disbursingAdv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">
                Disburse Salary Advance: {disbursingAdv.employee_name}
              </h3>
              <button onClick={() => setDisbursingAdv(null)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleDisburseAdvance} className="p-5 space-y-4 text-xs">
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 space-y-1">
                <div className="font-bold text-purple-900">Amount: ৳{disbursingAdv.amount.toLocaleString()}</div>
                <div className="text-purple-700 text-[11px]">
                  Repayment: ৳{disbursingAdv.monthly_deduction_amount.toLocaleString()}/month
                </div>
                <div className="text-stone-600 text-[11px]">Reason: {disbursingAdv.reason}</div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Disburse From Account *</label>
                <select
                  value={disburseAccount}
                  onChange={e => setDisburseAccount(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  {paymentAccounts.length > 0 ? (
                    paymentAccounts.map((acc: any) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Bal: ৳{(acc.balance || 0).toLocaleString()})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="acc_cash">Cash Register</option>
                      <option value="acc_bank">City Bank Account</option>
                      <option value="acc_bkash">bKash Account</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Disbursement Date</label>
                <input
                  type="date"
                  value={disburseDate}
                  onChange={e => setDisburseDate(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setDisbursingAdv(null)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-purple-700 text-white rounded font-bold hover:bg-purple-600">
                  Confirm Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
