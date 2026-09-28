import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Check,
  X,
  FileCheck,
  UserCheck,
  Filter,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AttendanceTabProps {
  attendanceRecords: any[];
  regularizations: any[];
  employees: any[];
  onManualAttendance: (data: any) => Promise<void>;
  onRequestRegularization: (data: any) => Promise<void>;
  onReviewRegularization: (id: string, status: string, notes: string) => Promise<void>;
  onPunchAttendance: (data: any) => Promise<void>;
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  attendanceRecords,
  regularizations,
  employees,
  onManualAttendance,
  onRequestRegularization,
  onReviewRegularization,
  onPunchAttendance,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [empFilter, setEmpFilter] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'records' | 'regularizations'>('records');

  // Manual Attendance Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    employee_id: employees[0]?.id || '',
    date: new Date().toISOString().slice(0, 10),
    clock_in: '09:00',
    clock_out: '18:00',
    status: 'present',
    reason: '',
  });

  // Request Regularization Modal
  const [showRegModal, setShowRegModal] = useState(false);
  const [regForm, setRegForm] = useState({
    employee_id: employees[0]?.id || '',
    date: new Date().toISOString().slice(0, 10),
    requested_clock_in: '09:00',
    requested_clock_out: '18:00',
    reason: '',
  });

  // Review Regularization Modal
  const [reviewingReg, setReviewingReg] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.reason) {
      alert('Mandatory reason required for manual attendance override.');
      return;
    }
    try {
      const inIso = `${manualForm.date}T${manualForm.clock_in}:00`;
      const outIso = manualForm.clock_out ? `${manualForm.date}T${manualForm.clock_out}:00` : undefined;
      await onManualAttendance({
        employee_id: manualForm.employee_id,
        date: manualForm.date,
        clock_in: inIso,
        clock_out: outIso,
        status: manualForm.status,
        reason: manualForm.reason,
      });
      setShowManualModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to submit manual attendance');
    }
  };

  const handleRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.reason) {
      alert('Please state reason for regularization.');
      return;
    }
    try {
      await onRequestRegularization(regForm);
      setShowRegModal(false);
    } catch (err: any) {
      alert(err.message || 'Regularization request failed');
    }
  };

  const handleReviewDecision = async (status: 'approved' | 'rejected') => {
    if (!reviewingReg) return;
    try {
      await onReviewRegularization(reviewingReg.id, status, reviewNotes);
      setReviewingReg(null);
      setReviewNotes('');
    } catch (err: any) {
      alert(err.message || 'Review action failed');
    }
  };

  const filteredAttendance = attendanceRecords.filter(r => {
    const matchesDate = !selectedDate || r.date === selectedDate;
    const matchesEmp = !empFilter || r.employee_id === empFilter;
    return matchesDate && matchesEmp;
  });

  return (
    <div className="space-y-6">
      {/* Subtabs Bar & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('records')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'records'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Attendance Roll & Logs
          </button>
          <button
            onClick={() => setActiveSubTab('regularizations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'regularizations'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span>Regularization Requests</span>
            {regularizations.filter(r => r.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                {regularizations.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRegModal(true)}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold transition"
          >
            Request Regularization
          </button>
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Manual Attendance Entry
          </button>
        </div>
      </div>

      {activeSubTab === 'records' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-stone-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-stone-500 font-medium">Filter Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-stone-500 font-medium">Employee:</span>
              <select
                value={empFilter}
                onChange={e => setEmpFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded border border-stone-300 bg-white focus:outline-none focus:border-amber-500"
              >
                <option value="">All Employees</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.designation || 'Staff'})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                setSelectedDate('');
                setEmpFilter('');
              }}
              className="text-amber-600 hover:underline text-xs ml-auto"
            >
              Clear Filters
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Clock In</th>
                    <th className="py-3 px-4">Clock Out</th>
                    <th className="py-3 px-4">Total Hours</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Method / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-400">
                        No attendance records found for this criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.map(att => (
                      <tr key={att.id} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4 font-medium text-stone-900">{att.date}</td>
                        <td className="py-3 px-4 font-bold text-stone-900">{att.employee_name}</td>
                        <td className="py-3 px-4 text-emerald-700 font-medium">
                          {att.clock_in ? new Date(att.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </td>
                        <td className="py-3 px-4 text-rose-700 font-medium">
                          {att.clock_out ? new Date(att.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-900">
                          {att.working_hours ? `${att.working_hours.toFixed(1)} hrs` : '--'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              att.status === 'present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : att.status === 'late'
                                ? 'bg-amber-100 text-amber-800'
                                : att.status === 'half_day'
                                ? 'bg-blue-100 text-blue-800'
                                : att.status === 'on_leave'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {att.status.toUpperCase()}
                          </span>
                          {att.late_minutes > 0 && (
                            <span className="text-[10px] text-amber-600 block">+{att.late_minutes}m late</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-stone-500">
                          {att.is_manual ? (
                            <span className="text-amber-700 font-medium">
                              Manual: {att.notes || att.manual_reason || 'Admin Entry'}
                            </span>
                          ) : (
                            <span className="text-stone-600">Terminal Punch</span>
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
      ) : (
        /* Regularizations Subtab */
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Target Date</th>
                  <th className="py-3 px-4">Requested Punch Times</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {regularizations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-stone-400">
                      No attendance regularization requests on record.
                    </td>
                  </tr>
                ) : (
                  regularizations.map(reg => (
                    <tr key={reg.id} className="hover:bg-stone-50/70">
                      <td className="py-3 px-4 font-bold text-stone-900">{reg.employee_name}</td>
                      <td className="py-3 px-4 font-medium text-stone-800">{reg.date}</td>
                      <td className="py-3 px-4">
                        In: {reg.requested_clock_in || '--:--'} • Out: {reg.requested_clock_out || '--:--'}
                      </td>
                      <td className="py-3 px-4 text-stone-600 max-w-xs truncate">{reg.reason}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            reg.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : reg.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {reg.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {reg.status === 'pending' ? (
                          <button
                            onClick={() => setReviewingReg(reg)}
                            className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded text-xs font-bold"
                          >
                            Review
                          </button>
                        ) : (
                          <span className="text-stone-400 text-[11px]">Completed</span>
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

      {/* Manual Attendance Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Manual Attendance Override</h3>
              <button onClick={() => setShowManualModal(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Select Employee *</label>
                <select
                  value={manualForm.employee_id}
                  onChange={e => setManualForm({ ...manualForm, employee_id: e.target.value })}
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
                <label className="block text-stone-700 font-semibold mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={manualForm.date}
                  onChange={e => setManualForm({ ...manualForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Clock In Time</label>
                  <input
                    type="time"
                    value={manualForm.clock_in}
                    onChange={e => setManualForm({ ...manualForm, clock_in: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Clock Out Time</label>
                  <input
                    type="time"
                    value={manualForm.clock_out}
                    onChange={e => setManualForm({ ...manualForm, clock_out: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Status</label>
                <select
                  value={manualForm.status}
                  onChange={e => setManualForm({ ...manualForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Mandatory Override Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="State reason for manual attendance record (audit log enforced)..."
                  value={manualForm.reason}
                  onChange={e => setManualForm({ ...manualForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Save Attendance Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Regularization Request Modal */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Request Attendance Regularization</h3>
              <button onClick={() => setShowRegModal(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRegSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Employee *</label>
                <select
                  value={regForm.employee_id}
                  onChange={e => setRegForm({ ...regForm, employee_id: e.target.value })}
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
                <label className="block text-stone-700 font-semibold mb-1">Missed Date *</label>
                <input
                  type="date"
                  required
                  value={regForm.date}
                  onChange={e => setRegForm({ ...regForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Actual Punch In</label>
                  <input
                    type="time"
                    value={regForm.requested_clock_in}
                    onChange={e => setRegForm({ ...regForm, requested_clock_in: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Actual Punch Out</label>
                  <input
                    type="time"
                    value={regForm.requested_clock_out}
                    onChange={e => setRegForm({ ...regForm, requested_clock_out: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Explanation / Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why punch was missed (e.g. power glitch, client meeting on field)..."
                  value={regForm.reason}
                  onChange={e => setRegForm({ ...regForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
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

      {/* Review Regularization Modal */}
      {reviewingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200 p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="font-bold text-sm text-stone-900">Review Regularization Request</h3>
              <button onClick={() => setReviewingReg(null)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1">
              <div className="font-bold text-stone-900">{reviewingReg.employee_name}</div>
              <div className="text-stone-600">Date: {reviewingReg.date}</div>
              <div className="text-stone-600">
                Requested Times: {reviewingReg.requested_clock_in} to {reviewingReg.requested_clock_out}
              </div>
              <div className="text-stone-700 pt-1 font-medium">Reason: {reviewingReg.reason}</div>
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Supervisor Review Notes</label>
              <textarea
                rows={2}
                placeholder="Optional review remarks..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                className="w-full px-3 py-2 rounded border border-stone-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                onClick={() => handleReviewDecision('rejected')}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold"
              >
                Reject
              </button>
              <button
                onClick={() => handleReviewDecision('approved')}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold"
              >
                Approve & Update Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
