import React, { useState } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
  TrendingUp,
  Cake,
  ShieldAlert,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface HRDashboardTabProps {
  stats: any;
  employees: any[];
  attendanceToday: any[];
  pendingLeaves: any[];
  pendingAdvances: any[];
  pendingRegularizations: any[];
  onNavigateTab: (tab: string) => void;
  onRefresh: () => void;
  currentUser: any;
  onClockPunch: (type: 'in' | 'out', notes?: string) => Promise<void>;
}

export const HRDashboardTab: React.FC<HRDashboardTabProps> = ({
  stats,
  employees,
  attendanceToday,
  pendingLeaves,
  pendingAdvances,
  pendingRegularizations,
  onNavigateTab,
  onRefresh,
  currentUser,
  onClockPunch,
}) => {
  const [punching, setPunching] = useState(false);
  const [punchNotes, setPunchNotes] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Find user's attendance status today if mapped
  const userEmp = employees.find(e => e.email === currentUser?.email || e.name === currentUser?.name);
  const userTodayRecord = userEmp ? attendanceToday.find(a => a.employee_id === userEmp.id) : null;
  const isPunchedIn = userTodayRecord?.clock_in && !userTodayRecord?.clock_out;

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePunch = async (type: 'in' | 'out') => {
    try {
      setPunching(true);
      await onClockPunch(type, punchNotes);
      setPunchNotes('');
    } catch (err: any) {
      alert(err.message || 'Punch failed');
    } finally {
      setPunching(false);
    }
  };

  const attendanceRate = stats?.total_employees
    ? Math.round(((stats?.present_today || 0) / stats.total_employees) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner: Quick Punch & Real-Time Presence */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white p-6 rounded-xl shadow-sm border border-stone-700 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <Clock className="w-4 h-4" /> Live Attendance Terminal
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>{currentTime}</span>
            <span className="text-sm font-normal text-stone-300">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </h2>
          <p className="text-sm text-stone-300">
            {userEmp ? `Logged in as: ${userEmp.name} (${userEmp.designation || 'Staff'})` : 'Ready for general attendance'}
          </p>
        </div>

        {/* Punch Clock Box */}
        <div className="flex flex-wrap items-center gap-3 bg-stone-800/80 p-3 rounded-lg border border-stone-600">
          <input
            type="text"
            placeholder="Optional punch note (e.g. Dhaka showroom)..."
            value={punchNotes}
            onChange={e => setPunchNotes(e.target.value)}
            className="text-xs bg-stone-900 text-white px-3 py-2 rounded border border-stone-700 focus:outline-none focus:border-amber-500 w-56"
          />
          <button
            onClick={() => handlePunch('in')}
            disabled={punching || Boolean(isPunchedIn)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition-colors ${
              isPunchedIn
                ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
            }`}
          >
            <LogIn className="w-4 h-4" />
            {isPunchedIn ? 'Clocked In' : 'Clock In'}
          </button>
          <button
            onClick={() => handlePunch('out')}
            disabled={punching || !isPunchedIn}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition-colors ${
              !isPunchedIn
                ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow'
            }`}
          >
            <LogOut className="w-4 h-4" />
            Clock Out
          </button>
          <button
            onClick={onRefresh}
            title="Refresh HR Data"
            className="p-2 text-stone-400 hover:text-white rounded hover:bg-stone-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div
          onClick={() => onNavigateTab('employees')}
          className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm cursor-pointer hover:border-amber-400 transition"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold text-stone-600 uppercase">Headcount</span>
            <Users className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-2xl font-bold text-stone-900">{stats?.total_employees || 0}</div>
          <div className="text-xs text-stone-500 mt-1">{stats?.active_employees || 0} active staff</div>
        </div>

        <div
          onClick={() => onNavigateTab('attendance')}
          className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm cursor-pointer hover:border-emerald-400 transition"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold text-stone-600 uppercase">Present Today</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{stats?.present_today || 0}</div>
          <div className="text-xs text-stone-500 mt-1">{attendanceRate}% turnout today</div>
        </div>

        <div
          onClick={() => onNavigateTab('attendance')}
          className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm cursor-pointer hover:border-amber-400 transition"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold text-stone-600 uppercase">Late Check-ins</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{stats?.late_today || 0}</div>
          <div className="text-xs text-stone-500 mt-1">Requires supervisor review</div>
        </div>

        <div
          onClick={() => onNavigateTab('leaves')}
          className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm cursor-pointer hover:border-blue-400 transition"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold text-stone-600 uppercase">On Leave</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats?.on_leave_today || 0}</div>
          <div className="text-xs text-stone-500 mt-1">{pendingLeaves.length} pending requests</div>
        </div>

        <div
          onClick={() => onNavigateTab('payroll')}
          className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm cursor-pointer hover:border-purple-400 transition"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold text-stone-600 uppercase">Pending Advances</span>
            <DollarSign className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-700">{pendingAdvances.length}</div>
          <div className="text-xs text-stone-500 mt-1">Awaiting disbursement</div>
        </div>

        <div
          onClick={() => onNavigateTab('recruitment')}
          className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm cursor-pointer hover:border-cyan-400 transition"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold text-stone-600 uppercase">Open Positions</span>
            <TrendingUp className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold text-cyan-700">{stats?.open_positions || 0}</div>
          <div className="text-xs text-stone-500 mt-1">Hiring active</div>
        </div>
      </div>

      {/* Main Grid: Approvals Inbox & Today's Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals Inbox */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-stone-900">Approvals & Action Inbox</h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
              {pendingLeaves.length + pendingAdvances.length + pendingRegularizations.length} Pending
            </span>
          </div>

          <div className="p-4 flex-1 divide-y divide-stone-100 overflow-y-auto max-h-96">
            {pendingLeaves.length === 0 && pendingAdvances.length === 0 && pendingRegularizations.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-70" />
                All approvals are up to date!
              </div>
            ) : (
              <>
                {pendingLeaves.map((l: any) => (
                  <div key={l.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{l.employee_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                          Leave: {l.leave_type_name || l.leave_type_id}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500">
                        {l.start_date} to {l.end_date} ({l.days} days) • Reason: {l.reason || 'N/A'}
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigateTab('leaves')}
                      className="text-xs px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium flex items-center gap-1"
                    >
                      Review <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {pendingAdvances.map((adv: any) => (
                  <div key={adv.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{adv.employee_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold">
                          Salary Advance ৳{adv.amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500">
                        Requested on {adv.request_date} • {adv.reason || 'Personal necessity'}
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigateTab('payroll')}
                      className="text-xs px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium flex items-center gap-1"
                    >
                      Disburse <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {pendingRegularizations.map((reg: any) => (
                  <div key={reg.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{reg.employee_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
                          Regularization: {reg.date}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500">
                        Times: {reg.requested_clock_in || '--:--'} - {reg.requested_clock_out || '--:--'} • {reg.reason}
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigateTab('attendance')}
                      className="text-xs px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium flex items-center gap-1"
                    >
                      Verify <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Live Attendance Roll Call */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-stone-900">Today's Attendance Roll Call</h3>
            </div>
            <button
              onClick={() => onNavigateTab('attendance')}
              className="text-xs text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1"
            >
              Full Log <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-96 divide-y divide-stone-100">
            {attendanceToday.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-sm">
                No punches recorded yet today. Staff punches will appear here in real time.
              </div>
            ) : (
              attendanceToday.map((att: any) => (
                <div key={att.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center font-bold text-xs text-stone-700">
                      {att.employee_name?.slice(0, 2).toUpperCase() || 'EM'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-900">{att.employee_name}</div>
                      <div className="text-[11px] text-stone-500">
                        In: {att.clock_in ? new Date(att.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        {att.clock_out ? ` • Out: ${new Date(att.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (Currently on site)'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        att.status === 'present'
                          ? 'bg-emerald-100 text-emerald-800'
                          : att.status === 'late'
                          ? 'bg-amber-100 text-amber-800'
                          : att.status === 'half_day'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {att.status.toUpperCase()}
                    </span>
                    {att.late_minutes > 0 && (
                      <div className="text-[10px] text-amber-600 font-medium">+{att.late_minutes}m late</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Upcoming Birthdays & Expiring Documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expiring Documents Alert */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 text-stone-900 font-bold text-sm">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>Document Compliance & Expiries</span>
          </div>
          {stats?.expiring_documents && stats.expiring_documents.length > 0 ? (
            <div className="space-y-2">
              {stats.expiring_documents.map((doc: any, i: number) => (
                <div key={i} className="p-2.5 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-rose-900">{doc.employee_name}</span>
                    <span className="text-rose-700 ml-1">({doc.document_type})</span>
                    <div className="text-[10px] text-rose-600">Expires: {doc.expiry_date}</div>
                  </div>
                  <button
                    onClick={() => onNavigateTab('employees')}
                    className="px-2 py-1 bg-white text-rose-700 rounded border border-rose-200 text-[11px] font-medium"
                  >
                    View File
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-stone-500 py-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              All employee NID, trade license, and contract documents are in compliance.
            </div>
          )}
        </div>

        {/* Upcoming Birthdays & Milestones */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3 text-stone-900 font-bold text-sm">
            <Cake className="w-4 h-4 text-amber-500" />
            <span>Team Birthdays & Celebrations</span>
          </div>
          {stats?.upcoming_birthdays && stats.upcoming_birthdays.length > 0 ? (
            <div className="space-y-2">
              {stats.upcoming_birthdays.map((b: any, i: number) => (
                <div key={i} className="p-2.5 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-amber-900">{b.name}</span>
                    <span className="text-amber-700 ml-1">({b.designation || 'Staff'})</span>
                    <div className="text-[10px] text-amber-600">Birthday: {b.dob}</div>
                  </div>
                  <span className="text-xs">🎉</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-stone-500 py-3">
              No team birthdays within the next 30 days.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
