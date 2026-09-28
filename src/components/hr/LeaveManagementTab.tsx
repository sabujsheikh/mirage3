import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Plus,
  Filter,
  Search,
  Check,
  X,
  AlertCircle,
  Sliders,
  FileText,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface LeaveManagementTabProps {
  leaveTypes: any[];
  leaveRequests: any[];
  employees: any[];
  onApplyLeave: (data: any) => Promise<void>;
  onReviewLeave: (id: string, action: string, notes: string) => Promise<void>;
  onAdjustBalance: (data: any) => Promise<void>;
}

export const LeaveManagementTab: React.FC<LeaveManagementTabProps> = ({
  leaveTypes,
  leaveRequests,
  employees,
  onApplyLeave,
  onReviewLeave,
  onAdjustBalance,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'requests' | 'balances' | 'types'>('requests');
  const [statusFilter, setStatusFilter] = useState('');
  const [empFilter, setEmpFilter] = useState('');

  // Modals
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    employee_id: employees[0]?.id || '',
    leave_type_id: leaveTypes[0]?.id || 'lt_casual',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    days: 1,
    reason: '',
  });

  const [reviewingReq, setReviewingReq] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Balance Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    employee_id: employees[0]?.id || '',
    leave_type_id: leaveTypes[0]?.id || 'lt_casual',
    adjustment_days: 1,
    reason: '',
  });

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.reason) {
      alert('Please state a reason for the leave application.');
      return;
    }
    try {
      await onApplyLeave(applyForm);
      setShowApplyModal(false);
    } catch (err: any) {
      alert(err.message || 'Leave application failed');
    }
  };

  const handleReviewAction = async (action: 'manager_approve' | 'manager_reject' | 'hr_approve' | 'hr_reject') => {
    if (!reviewingReq) return;
    try {
      await onReviewLeave(reviewingReq.id, action, reviewNotes);
      setReviewingReq(null);
      setReviewNotes('');
    } catch (err: any) {
      alert(err.message || 'Leave review action failed');
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.reason) {
      alert('Reason is required for manual balance adjustments (audit logged).');
      return;
    }
    try {
      await onAdjustBalance(adjustForm);
      setShowAdjustModal(false);
    } catch (err: any) {
      alert(err.message || 'Adjustment failed');
    }
  };

  const filteredRequests = leaveRequests.filter(req => {
    const matchesStatus = !statusFilter || req.status === statusFilter;
    const matchesEmp = !empFilter || req.employee_id === empFilter;
    return matchesStatus && matchesEmp;
  });

  return (
    <div className="space-y-6">
      {/* Subtab & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('requests')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'requests'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span>Leave Applications</span>
            {leaveRequests.filter(r => r.status.includes('pending')).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-[10px]">
                {leaveRequests.filter(r => r.status.includes('pending')).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('balances')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'balances'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Employee Balances
          </button>

          <button
            onClick={() => setActiveSubTab('types')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'types'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Leave Policies & Entitlements
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdjustModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold transition"
          >
            <Sliders className="w-3.5 h-3.5" /> Adjust Balance
          </button>
          <button
            onClick={() => setShowApplyModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Apply for Leave
          </button>
        </div>
      </div>

      {activeSubTab === 'requests' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-stone-200 text-xs">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-stone-300 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="pending_manager">Pending Manager</option>
              <option value="pending_hr">Pending HR</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={empFilter}
              onChange={e => setEmpFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-stone-300 bg-white"
            >
              <option value="">All Employees</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setStatusFilter('');
                setEmpFilter('');
              }}
              className="text-amber-600 hover:underline text-xs ml-auto"
            >
              Reset
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4">Days</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Approval Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-400">
                        No leave applications matching selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map(req => (
                      <tr key={req.id} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4 font-bold text-stone-900">{req.employee_name}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-stone-800">
                            {req.leave_type_name || req.leave_type_id}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-stone-600">
                          {req.start_date} to {req.end_date}
                        </td>
                        <td className="py-3 px-4 font-bold text-stone-900">{req.days} days</td>
                        <td className="py-3 px-4 text-stone-600 max-w-xs truncate">{req.reason}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : req.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {req.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {req.status.includes('pending') ? (
                            <button
                              onClick={() => setReviewingReq(req)}
                              className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded text-xs font-bold"
                            >
                              Review
                            </button>
                          ) : (
                            <span className="text-stone-400 text-[11px]">Decided</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'balances' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-stone-200">
            <h3 className="font-bold text-sm text-stone-900">Current Employee Leave Ledgers</h3>
            <p className="text-xs text-stone-500">Live breakdown of allotted, used, and remaining leave quotas.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Casual Leave (Remaining / Allotted)</th>
                  <th className="py-3 px-4">Sick Leave (Remaining / Allotted)</th>
                  <th className="py-3 px-4">Annual / Earned Leave</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-stone-50/70">
                    <td className="py-3 px-4">
                      <div className="font-bold text-stone-900">{emp.name}</div>
                      <div className="text-[11px] text-stone-400">{emp.designation || 'Staff'}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-800">
                      8 / 10 days
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-800">
                      12 / 14 days
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-800">
                      15 / 18 days
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setAdjustForm({ ...adjustForm, employee_id: emp.id });
                          setShowAdjustModal(true);
                        }}
                        className="text-xs text-amber-700 hover:text-amber-800 font-bold"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'types' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaveTypes.map(lt => (
            <div key={lt.id} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-900 text-sm">{lt.name}</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700">
                  {lt.code}
                </span>
              </div>
              <div className="text-2xl font-bold text-stone-900">
                {lt.days_per_year} <span className="text-xs text-stone-500 font-normal">days/year</span>
              </div>
              <div className="space-y-1 text-xs text-stone-600 border-t border-stone-100 pt-2">
                <div className="flex justify-between">
                  <span>Paid Leave:</span>
                  <span className="font-semibold text-stone-900">{lt.is_paid ? 'Yes' : 'Unpaid'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Carry Forward Allowed:</span>
                  <span className="font-semibold text-stone-900">
                    {lt.carry_forward_allowed ? `Yes (max ${lt.max_carry_forward_days || 0}d)` : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Encashment Allowed:</span>
                  <span className="font-semibold text-stone-900">{lt.encashment_allowed ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Apply for Leave</h3>
              <button onClick={() => setShowApplyModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleApply} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Employee *</label>
                <select
                  value={applyForm.employee_id}
                  onChange={e => setApplyForm({ ...applyForm, employee_id: e.target.value })}
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
                <label className="block text-stone-700 font-semibold mb-1">Leave Category</label>
                <select
                  value={applyForm.leave_type_id}
                  onChange={e => setApplyForm({ ...applyForm, leave_type_id: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.days_per_year} days/yr)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={applyForm.start_date}
                    onChange={e => setApplyForm({ ...applyForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={applyForm.end_date}
                    onChange={e => setApplyForm({ ...applyForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Number of Days</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={applyForm.days}
                  onChange={e => setApplyForm({ ...applyForm, days: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Reason for Leave *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="State reason..."
                  value={applyForm.reason}
                  onChange={e => setApplyForm({ ...applyForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Leave Modal */}
      {reviewingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200 p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="font-bold text-sm text-stone-900">Review Leave Application</h3>
              <button onClick={() => setReviewingReq(null)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1">
              <div className="font-bold text-stone-900">{reviewingReq.employee_name}</div>
              <div className="text-stone-600">Category: {reviewingReq.leave_type_name || reviewingReq.leave_type_id}</div>
              <div className="text-stone-600">
                Dates: {reviewingReq.start_date} to {reviewingReq.end_date} ({reviewingReq.days} days)
              </div>
              <div className="text-stone-700 pt-1 font-medium">Reason: {reviewingReq.reason}</div>
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Review Remarks</label>
              <textarea
                rows={2}
                placeholder="Optional review notes..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                className="w-full px-3 py-2 rounded border border-stone-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                onClick={() => handleReviewAction('manager_reject')}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold"
              >
                Reject Application
              </button>
              <button
                onClick={() => handleReviewAction('manager_approve')}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold"
              >
                Approve Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Adjust Leave Balance (Manual Override)</h3>
              <button onClick={() => setShowAdjustModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdjustBalance} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Employee *</label>
                <select
                  value={adjustForm.employee_id}
                  onChange={e => setAdjustForm({ ...adjustForm, employee_id: e.target.value })}
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
                <label className="block text-stone-700 font-semibold mb-1">Leave Type *</label>
                <select
                  value={adjustForm.leave_type_id}
                  onChange={e => setAdjustForm({ ...adjustForm, leave_type_id: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Adjustment Days (+ to grant, - to deduct)
                </label>
                <input
                  type="number"
                  step={0.5}
                  value={adjustForm.adjustment_days}
                  onChange={e => setAdjustForm({ ...adjustForm, adjustment_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Mandatory Audit Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="State reason for manual balance override (e.g. compensatory off for weekend event)..."
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
