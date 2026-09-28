import React, { useState } from 'react';
import {
  UserMinus,
  CheckSquare,
  Square,
  DollarSign,
  AlertCircle,
  FileCheck,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface OffboardingTabProps {
  offboardings: any[];
  employees: any[];
  paymentAccounts: any[];
  onInitiateExit: (data: any) => Promise<void>;
  onUpdateClearance: (id: string, department: string, cleared: boolean, notes: string) => Promise<void>;
  onCalculateFnF: (id: string) => Promise<any>;
  onDisburseFnF: (id: string, paymentAccountId: string, notes: string) => Promise<void>;
}

export const OffboardingTab: React.FC<OffboardingTabProps> = ({
  offboardings,
  employees,
  paymentAccounts,
  onInitiateExit,
  onUpdateClearance,
  onCalculateFnF,
  onDisburseFnF,
}) => {
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitForm, setExitForm] = useState({
    employee_id: employees[0]?.id || '',
    exit_type: 'resignation',
    notice_date: new Date().toISOString().slice(0, 10),
    last_working_day: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    reason: '',
  });

  const [selectedOffboarding, setSelectedOffboarding] = useState<any | null>(null);
  const [fnfData, setFnfData] = useState<any | null>(null);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [disburseAccount, setDisburseAccount] = useState('acc_cash');
  const [disburseNotes, setDisburseNotes] = useState('');

  const handleInitiateExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitForm.reason) {
      alert('Exit reason is required.');
      return;
    }
    try {
      await onInitiateExit(exitForm);
      setShowExitModal(false);
      alert('Offboarding process initiated.');
    } catch (err: any) {
      alert(err.message || 'Failed to initiate exit');
    }
  };

  const handleToggleClearance = async (offboardingId: string, dept: string, currentVal: boolean) => {
    try {
      await onUpdateClearance(offboardingId, dept, !currentVal, `Cleared by HR coordinator`);
    } catch (err: any) {
      alert(err.message || 'Clearance update failed');
    }
  };

  const handleViewFnF = async (offboarding: any) => {
    setSelectedOffboarding(offboarding);
    try {
      const data = await onCalculateFnF(offboarding.id);
      setFnfData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to calculate FnF');
    }
  };

  const handleDisburseFnF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffboarding) return;
    try {
      await onDisburseFnF(selectedOffboarding.id, disburseAccount, disburseNotes);
      setShowDisburseModal(false);
      setSelectedOffboarding(null);
      setFnfData(null);
      alert('Full & Final Settlement posted to General Ledger and employee deactivated!');
    } catch (err: any) {
      alert(err.message || 'Disbursement failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h3 className="font-bold text-sm text-stone-900">Offboarding & Full-and-Final (FnF) Settlements</h3>
          <p className="text-xs text-stone-500">
            Audit-compliant clearance checklists, asset returns, and final financial disbursements.
          </p>
        </div>

        <button
          onClick={() => setShowExitModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition shadow-sm"
        >
          <UserMinus className="w-3.5 h-3.5" /> Initiate Employee Exit
        </button>
      </div>

      {/* Exits List */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Exit Type</th>
                <th className="py-3 px-4">Notice Date</th>
                <th className="py-3 px-4">Last Working Day</th>
                <th className="py-3 px-4">Department Clearance</th>
                <th className="py-3 px-4">Settlement Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {offboardings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">
                    No active offboarding processes.
                  </td>
                </tr>
              ) : (
                offboardings.map(item => {
                  const clearances = item.clearances || {};
                  const allCleared = Object.values(clearances).every((c: any) => c?.cleared);

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/70">
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900">{item.employee_name}</div>
                        <div className="text-[11px] text-stone-400">{item.reason}</div>
                      </td>
                      <td className="py-3 px-4 uppercase font-semibold text-stone-800">
                        {item.exit_type}
                      </td>
                      <td className="py-3 px-4 text-stone-600">{item.notice_date}</td>
                      <td className="py-3 px-4 font-bold text-stone-900">{item.last_working_day}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {['it', 'inventory', 'admin', 'finance'].map(dept => {
                            const isCleared = clearances[dept]?.cleared;
                            return (
                              <button
                                key={dept}
                                onClick={() => handleToggleClearance(item.id, dept, isCleared)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border ${
                                  isCleared
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}
                              >
                                {isCleared ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                                <span className="uppercase">{dept}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.settlement_status === 'settled'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.settlement_status ? item.settlement_status.toUpperCase() : 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleViewFnF(item)}
                          className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded text-xs font-bold"
                        >
                          FnF Settlement
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FnF Calculation Modal */}
      {selectedOffboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-stone-200 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-stone-900">
                  Full & Final Settlement: {selectedOffboarding.employee_name}
                </h3>
                <div className="text-stone-500 text-[11px]">
                  LWD: {selectedOffboarding.last_working_day} • Type: {selectedOffboarding.exit_type}
                </div>
              </div>
              <button onClick={() => setSelectedOffboarding(null)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {fnfData ? (
              <div className="space-y-3">
                <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-stone-600">Base Monthly Salary:</span>
                    <span className="font-bold text-stone-900">৳{fnfData.base_salary?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Earned Salary (Prorated):</span>
                    <span className="font-semibold text-emerald-700">+৳{fnfData.earned_salary?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Unused Leave Encashment:</span>
                    <span className="font-semibold text-emerald-700">+৳{fnfData.leave_encashment?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Notice Pay Adjustment:</span>
                    <span className="font-semibold text-stone-700">৳{fnfData.notice_pay_adjustment?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Pending Advance Recovery:</span>
                    <span className="font-semibold text-rose-600">-৳{fnfData.advance_recovery?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 text-sm font-bold border-t border-stone-200">
                    <span className="text-stone-900">Net Payable Settlement:</span>
                    <span className="text-emerald-700">৳{fnfData.net_payable?.toLocaleString()}</span>
                  </div>
                </div>

                {selectedOffboarding.settlement_status !== 'settled' && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setShowDisburseModal(true)}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-1.5"
                    >
                      <DollarSign className="w-4 h-4" /> Disburse & Post to Accounts
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-stone-400">Loading settlement calculation...</div>
            )}
          </div>
        </div>
      )}

      {/* Disburse FnF Modal */}
      {showDisburseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Confirm FnF Disbursement</h3>
              <button onClick={() => setShowDisburseModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleDisburseFnF} className="p-5 space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-900">
                <p className="font-bold">General Ledger Integration:</p>
                <p className="text-[11px] mt-1">
                  This transaction will debit Salary Expense for ৳{fnfData?.net_payable?.toLocaleString()}, credit the
                  chosen payment account, and mark the employee as Inactive in the database.
                </p>
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
                      <option value="acc_cash">Cash Register (Main Till)</option>
                      <option value="acc_bank">City Bank Corporate A/C</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="FnF settlement final payout"
                  value={disburseNotes}
                  onChange={e => setDisburseNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowDisburseModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-700 text-white rounded font-bold hover:bg-emerald-600">
                  Disburse & Finalize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Initiate Exit Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Initiate Employee Offboarding</h3>
              <button onClick={() => setShowExitModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInitiateExit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Employee *</label>
                <select
                  value={exitForm.employee_id}
                  onChange={e => setExitForm({ ...exitForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Exit Type</label>
                <select
                  value={exitForm.exit_type}
                  onChange={e => setExitForm({ ...exitForm, exit_type: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  <option value="resignation">Resignation (Employee Notice)</option>
                  <option value="termination">Termination</option>
                  <option value="end_of_contract">End of Contract</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Notice Date</label>
                  <input
                    type="date"
                    required
                    value={exitForm.notice_date}
                    onChange={e => setExitForm({ ...exitForm, notice_date: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Last Working Day</label>
                  <input
                    type="date"
                    required
                    value={exitForm.last_working_day}
                    onChange={e => setExitForm({ ...exitForm, last_working_day: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Reason for Exit *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Document reason for exit..."
                  value={exitForm.reason}
                  onChange={e => setExitForm({ ...exitForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-rose-700 text-white rounded font-bold hover:bg-rose-600">
                  Initiate Exit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
