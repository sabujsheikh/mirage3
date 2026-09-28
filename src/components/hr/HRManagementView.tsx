import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  Calendar,
  DollarSign,
  Briefcase,
  TrendingUp,
  UserMinus,
  Building2,
  Sliders,
  LayoutDashboard,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { hrApi } from './hrApi';
import { HRDashboardTab } from './HRDashboardTab';
import { EmployeesTab } from './EmployeesTab';
import { AttendanceTab } from './AttendanceTab';
import { LeaveManagementTab } from './LeaveManagementTab';
import { PayrollAdvancesTab } from './PayrollAdvancesTab';
import { RecruitmentTab } from './RecruitmentTab';
import { PerformanceTab } from './PerformanceTab';
import { OffboardingTab } from './OffboardingTab';
import { OrganizationTab } from './OrganizationTab';
import { HRSettingsTab } from './HRSettingsTab';

interface HRManagementViewProps {
  currentUser?: any;
}

export const HRManagementView: React.FC<HRManagementViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'employees'
    | 'attendance'
    | 'leaves'
    | 'payroll'
    | 'recruitment'
    | 'performance'
    | 'offboarding'
    | 'organization'
    | 'settings'
  >('dashboard');

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [regularizationRequests, setRegularizationRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [salaryAdvances, setSalaryAdvances] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [offboardings, setOffboardings] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        emps,
        depts,
        desigs,
        brs,
        shs,
        hols,
        attLogs,
        regReqs,
        lTypes,
        lReqs,
        advs,
        jbList,
        candList,
        gList,
        rList,
        offList,
        sett,
        notifs,
        accountsRes,
      ] = await Promise.all([
        hrApi.getEmployees(),
        hrApi.getDepartments(),
        hrApi.getDesignations(),
        hrApi.getBranches(),
        hrApi.getShifts(),
        hrApi.getHolidays(),
        hrApi.getAttendanceLogs(new Date().toISOString().slice(0, 10)),
        hrApi.getRegularizationRequests(),
        hrApi.getLeaveTypes(),
        hrApi.getLeaveRequests(),
        hrApi.getSalaryAdvances(),
        hrApi.getJobOpenings(),
        hrApi.getCandidates(),
        hrApi.getGoals(),
        hrApi.getPerformanceReviews(),
        hrApi.getOffboardings(),
        hrApi.getSettings(),
        hrApi.getNotifications(currentUser?.id || 'usr_owner'),
        fetch('/api/payment-accounts')
          .then(res => res.json())
          .catch(() => []),
      ]);

      setEmployees(Array.isArray(emps) ? emps : (emps?.items || []));
      setDepartments(depts || []);
      setDesignations(desigs || []);
      setBranches(brs || []);
      setShifts(shs || []);
      setHolidays(hols || []);
      setAttendanceLogs(attLogs || []);
      setRegularizationRequests(regReqs || []);
      setLeaveTypes(lTypes || []);
      setLeaveRequests(lReqs || []);
      setSalaryAdvances(advs || []);
      setJobs(jbList || []);
      setCandidates(candList || []);
      setGoals(gList || []);
      setReviews(rList || []);
      setOffboardings(offList || []);
      setSettings(sett || {});
      setNotifications(notifs || []);
      setPaymentAccounts(Array.isArray(accountsRes) ? accountsRes : accountsRes.accounts || []);
    } catch (err: any) {
      console.error('Error loading HR data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handler helpers
  const handlePunch = async (type: 'check_in' | 'check_out', notes?: string) => {
    const empId = employees[0]?.id || 'emp_default';
    await hrApi.recordAttendancePunch({
      employee_id: empId,
      punch_type: type,
      source: 'web_portal',
      notes,
    });
    const refreshed = await hrApi.getAttendanceLogs(new Date().toISOString().slice(0, 10));
    setAttendanceLogs(refreshed);
  };

  const handleCreateEmployee = async (data: any) => {
    await hrApi.createEmployee(data);
    const emps = await hrApi.getEmployees();
    setEmployees(emps);
  };

  const handleUpdateEmployee = async (id: string, data: any) => {
    await hrApi.updateEmployee(id, data);
    const emps = await hrApi.getEmployees();
    setEmployees(emps);
  };

  const handleUploadDoc = async (empId: string, doc: any) => {
    await hrApi.addEmployeeDocument(empId, doc);
    const emps = await hrApi.getEmployees();
    setEmployees(emps);
  };

  const handleManualAttendance = async (data: any) => {
    await hrApi.createManualAttendance(data);
    const refreshed = await hrApi.getAttendanceLogs();
    setAttendanceLogs(refreshed);
  };

  const handleRequestRegularization = async (data: any) => {
    await hrApi.requestRegularization(data);
    const refreshed = await hrApi.getRegularizationRequests();
    setRegularizationRequests(refreshed);
  };

  const handleReviewRegularization = async (id: string, action: string, notes: string) => {
    await hrApi.reviewRegularization(id, action, notes);
    const refreshed = await hrApi.getRegularizationRequests();
    setRegularizationRequests(refreshed);
    const atts = await hrApi.getAttendanceLogs();
    setAttendanceLogs(atts);
  };

  const handleApplyLeave = async (data: any) => {
    await hrApi.applyLeave(data);
    const lReqs = await hrApi.getLeaveRequests();
    setLeaveRequests(lReqs);
  };

  const handleReviewLeave = async (id: string, action: string, notes: string) => {
    await hrApi.reviewLeave(id, action, notes);
    const lReqs = await hrApi.getLeaveRequests();
    setLeaveRequests(lReqs);
  };

  const handleAdjustLeaveBalance = async (data: any) => {
    await hrApi.adjustLeaveBalance(data);
  };

  const handleCalculatePayroll = async (month: string) => {
    return await hrApi.calculatePayroll(month);
  };

  const handleOverridePayroll = async (data: any) => {
    await hrApi.overridePayrollLine(data);
  };

  const handleFinalizePayroll = async (month: string, paymentAccountId: string, notes?: string) => {
    await hrApi.finalizePayrollBatch({
      month,
      disbursement_account_id: paymentAccountId,
      notes,
    });
  };

  const handleRequestAdvance = async (data: any) => {
    await hrApi.requestSalaryAdvance(data);
    const advs = await hrApi.getSalaryAdvances();
    setSalaryAdvances(advs);
  };

  const handleDisburseAdvance = async (advanceId: string, paymentAccountId: string, paymentDate: string) => {
    await hrApi.disburseSalaryAdvance(advanceId, paymentAccountId, paymentDate);
    const advs = await hrApi.getSalaryAdvances();
    setSalaryAdvances(advs);
  };

  const handleCreateJob = async (data: any) => {
    await hrApi.createJobOpening(data);
    const jbList = await hrApi.getJobOpenings();
    setJobs(jbList);
  };

  const handleCreateCandidate = async (data: any) => {
    await hrApi.createCandidate(data);
    const candList = await hrApi.getCandidates();
    setCandidates(candList);
  };

  const handleUpdateCandidateStage = async (id: string, stage: string, notes: string) => {
    await hrApi.updateCandidateStage(id, { stage, notes });
    const candList = await hrApi.getCandidates();
    setCandidates(candList);
  };

  const handleHireCandidate = async (id: string, empData: any) => {
    await hrApi.hireCandidate(id, empData);
    const [candList, emps] = await Promise.all([hrApi.getCandidates(), hrApi.getEmployees()]);
    setCandidates(candList);
    setEmployees(emps);
  };

  const handleCreateGoal = async (data: any) => {
    await hrApi.createGoal(data);
    const gList = await hrApi.getGoals();
    setGoals(gList);
  };

  const handleUpdateGoal = async (id: string, data: any) => {
    await hrApi.updateGoal(id, data);
    const gList = await hrApi.getGoals();
    setGoals(gList);
  };

  const handleCreateReview = async (data: any) => {
    await hrApi.createPerformanceReview(data);
    const rList = await hrApi.getPerformanceReviews();
    setReviews(rList);
  };

  const handleInitiateExit = async (data: any) => {
    await hrApi.initiateOffboarding(data);
    const offList = await hrApi.getOffboardings();
    setOffboardings(offList);
  };

  const handleUpdateClearance = async (id: string, dept: string, cleared: boolean, notes: string) => {
    await hrApi.updateClearance(id, { department: dept, cleared, notes });
    const offList = await hrApi.getOffboardings();
    setOffboardings(offList);
  };

  const handleCalculateFnF = async (id: string) => {
    return await hrApi.calculateFnF(id);
  };

  const handleDisburseFnF = async (id: string, paymentAccountId: string, notes: string) => {
    await hrApi.disburseFnF(id, { payment_account_id: paymentAccountId, notes });
    const [offList, emps] = await Promise.all([hrApi.getOffboardings(), hrApi.getEmployees()]);
    setOffboardings(offList);
    setEmployees(emps);
  };

  const handleCreateDept = async (data: any) => {
    await hrApi.createDepartment(data);
    const d = await hrApi.getDepartments();
    setDepartments(d);
  };

  const handleCreateDesig = async (data: any) => {
    await hrApi.createDesignation(data);
    const d = await hrApi.getDesignations();
    setDesignations(d);
  };

  const handleCreateBranch = async (data: any) => {
    await hrApi.createBranch(data);
    const b = await hrApi.getBranches();
    setBranches(b);
  };

  const handleCreateShift = async (data: any) => {
    await hrApi.createShift(data);
    const s = await hrApi.getShifts();
    setShifts(s);
  };

  const handleCreateHoliday = async (data: any) => {
    await hrApi.createHoliday(data);
    const h = await hrApi.getHolidays();
    setHolidays(h);
  };

  const handleUpdateSettings = async (data: any) => {
    await hrApi.updateSettings(data);
    const sett = await hrApi.getSettings();
    setSettings(sett);
  };

  const navTabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'employees', label: 'Employees', icon: Users, badge: employees.length },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    {
      id: 'leaves',
      label: 'Leaves',
      icon: Calendar,
      badge: leaveRequests.filter(r => r.status.includes('pending')).length,
    },
    { id: 'payroll', label: 'Payroll & Advances', icon: DollarSign },
    { id: 'recruitment', label: 'Recruitment', icon: Briefcase },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'offboarding', label: 'Offboarding', icon: UserMinus },
    { id: 'organization', label: 'Org Structure', icon: Building2 },
    { id: 'settings', label: 'Policies', icon: Sliders },
  ];

  return (
    <div className="space-y-6">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500 text-stone-900 rounded-xl font-bold">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-stone-900 tracking-tight">HR Management Suite</h1>
              <p className="text-xs text-stone-500">
                End-to-end workforce operations, biometric/manual attendance, policy governance & payroll accounting.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            title="Refresh HR Data"
            className="p-2 border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-stone-200 scrollbar-none">
        {navTabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                active
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200/70'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-stone-400'}`} />
              <span>{tab.label}</span>
              {Boolean(tab.badge) && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    active ? 'bg-amber-400 text-stone-900' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {loading ? (
        <div className="py-16 text-center text-stone-400 bg-white rounded-2xl border border-stone-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-400" />
          <span className="text-xs font-medium">Synchronizing HR data and accounting ledgers...</span>
        </div>
      ) : (
        <div>
          {activeTab === 'dashboard' && (
            <HRDashboardTab
              stats={{
                total_employees: employees.length,
                present_today: attendanceLogs.filter(a => a.status === 'present').length,
                on_leave: leaveRequests.filter(r => r.status === 'approved').length,
                pending_approvals: leaveRequests.filter(r => r.status.includes('pending')).length + salaryAdvances.filter(a => a.status === 'approved').length,
              }}
              employees={employees}
              attendanceToday={attendanceLogs}
              pendingLeaves={leaveRequests.filter(r => r.status.includes('pending'))}
              pendingAdvances={salaryAdvances.filter(a => a.status === 'approved' || a.status === 'requested')}
              pendingRegularizations={regularizationRequests.filter(r => r.status === 'pending')}
              onNavigateTab={(t: string) => setActiveTab(t as any)}
              onRefresh={loadData}
              currentUser={currentUser}
              onClockPunch={async (type: 'in' | 'out', notes?: string) => {
                await handlePunch(type === 'in' ? 'check_in' : 'check_out', notes);
              }}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeesTab
              employees={employees}
              departments={departments}
              designations={designations}
              branches={branches}
              shifts={shifts}
              onCreateEmployee={handleCreateEmployee}
              onUpdateEmployee={handleUpdateEmployee}
              onAddDocument={handleUploadDoc}
              onRemoveDocument={async (id: string, docId: string) => {
                await hrApi.removeEmployeeDocument(id, docId);
                const emps = await hrApi.getEmployees();
                setEmployees(emps);
              }}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceTab
              attendanceRecords={attendanceLogs}
              regularizations={regularizationRequests}
              employees={employees}
              onManualAttendance={handleManualAttendance}
              onRequestRegularization={handleRequestRegularization}
              onReviewRegularization={handleReviewRegularization}
              onPunchAttendance={async (data: any) => {
                await hrApi.punchAttendance(data);
                const atts = await hrApi.getAttendanceLogs();
                setAttendanceLogs(atts);
              }}
            />
          )}

          {activeTab === 'leaves' && (
            <LeaveManagementTab
              leaveTypes={leaveTypes}
              leaveRequests={leaveRequests}
              employees={employees}
              onApplyLeave={handleApplyLeave}
              onReviewLeave={handleReviewLeave}
              onAdjustBalance={handleAdjustLeaveBalance}
            />
          )}

          {activeTab === 'payroll' && (
            <PayrollAdvancesTab
              employees={employees}
              salaryAdvances={salaryAdvances}
              paymentAccounts={paymentAccounts}
              onCalculatePayroll={handleCalculatePayroll}
              onOverridePayrollLine={handleOverridePayroll}
              onFinalizePayroll={handleFinalizePayroll}
              onRequestAdvance={handleRequestAdvance}
              onDisburseAdvance={handleDisburseAdvance}
            />
          )}

          {activeTab === 'recruitment' && (
            <RecruitmentTab
              jobs={jobs}
              candidates={candidates}
              departments={departments}
              onCreateJob={handleCreateJob}
              onCreateCandidate={handleCreateCandidate}
              onUpdateStage={handleUpdateCandidateStage}
              onHireCandidate={handleHireCandidate}
            />
          )}

          {activeTab === 'performance' && (
            <PerformanceTab
              goals={goals}
              reviews={reviews}
              employees={employees}
              onCreateGoal={handleCreateGoal}
              onUpdateGoal={handleUpdateGoal}
              onCreateReview={handleCreateReview}
            />
          )}

          {activeTab === 'offboarding' && (
            <OffboardingTab
              offboardings={offboardings}
              employees={employees}
              paymentAccounts={paymentAccounts}
              onInitiateExit={handleInitiateExit}
              onUpdateClearance={handleUpdateClearance}
              onCalculateFnF={handleCalculateFnF}
              onDisburseFnF={handleDisburseFnF}
            />
          )}

          {activeTab === 'organization' && (
            <OrganizationTab
              departments={departments}
              designations={designations}
              branches={branches}
              shifts={shifts}
              holidays={holidays}
              onCreateDepartment={handleCreateDept}
              onCreateDesignation={handleCreateDesig}
              onCreateBranch={handleCreateBranch}
              onCreateShift={handleCreateShift}
              onCreateHoliday={handleCreateHoliday}
            />
          )}

          {activeTab === 'settings' && (
            <HRSettingsTab settings={settings} onUpdateSettings={handleUpdateSettings} />
          )}
        </div>
      )}
    </div>
  );
};
