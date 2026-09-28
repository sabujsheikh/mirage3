/**
 * Typed client API for HR Management Module
 */

export const hrApi = {
  // Dashboard & Settings
  async getDashboard() {
    const res = await fetch('/api/hr/dashboard');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getSettings() {
    const res = await fetch('/api/hr/settings');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateSettings(settings: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Organization
  async getDepartments() {
    const res = await fetch('/api/hr/departments');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createDepartment(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateDepartment(id: string, data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch(`/api/hr/departments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getDesignations() {
    const res = await fetch('/api/hr/designations');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createDesignation(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/designations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getBranches() {
    const res = await fetch('/api/hr/branches');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createBranch(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getShifts() {
    const res = await fetch('/api/hr/shifts');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createShift(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getHolidays() {
    const res = await fetch('/api/hr/holidays');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createHoliday(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteHoliday(id: string, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch(`/api/hr/holidays/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Employees
  async getEmployees(params?: Record<string, any>) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`/api/hr/employees${q}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return Array.isArray(data) ? data : (data.items || []);
  },

  async getEmployeeById(id: string) {
    const res = await fetch(`/api/hr/employees/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createEmployee(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateEmployee(id: string, data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch(`/api/hr/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async addEmployeeDocument(id: string, doc: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch(`/api/hr/employees/${id}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...doc, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async removeEmployeeDocument(id: string, docId: string, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch(`/api/hr/employees/${id}/documents/${docId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Attendance
  async getAttendance(params?: Record<string, any>) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`/api/hr/attendance${q}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getAttendanceLogs(date?: string) {
    return this.getAttendance(date ? { date } : undefined);
  },

  async punchAttendance(data: any) {
    const res = await fetch('/api/hr/attendance/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async recordAttendancePunch(data: any) {
    return this.punchAttendance(data);
  },

  async manualAttendance(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/attendance/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createManualAttendance(data: any) {
    return this.manualAttendance(data);
  },

  async getRegularizations(params?: Record<string, any>) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`/api/hr/attendance/regularizations${q}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getRegularizationRequests() {
    return this.getRegularizations();
  },

  async requestRegularization(data: any) {
    const res = await fetch('/api/hr/attendance/regularizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async reviewRegularization(id: string, actionOrStatus: any, reviewNotes?: string, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const status = typeof actionOrStatus === 'string' ? actionOrStatus : actionOrStatus.action || actionOrStatus.status || 'approved';
    const notes = reviewNotes || (typeof actionOrStatus === 'object' ? actionOrStatus.review_notes : '') || '';
    const res = await fetch(`/api/hr/attendance/regularizations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, review_notes: notes, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Leave Management
  async getLeaveTypes() {
    const res = await fetch('/api/hr/leaves/types');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createLeaveType(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/leaves/types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getLeaveRequests(params?: Record<string, any>) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(`/api/hr/leaves/requests${q}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async applyLeave(data: any) {
    const res = await fetch('/api/hr/leaves/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async reviewLeave(id: string, action: string, notes: string, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch(`/api/hr/leaves/requests/${id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async adjustLeaveBalance(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/leaves/adjust-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Salary Advances
  async getSalaryAdvances(employeeId?: string) {
    const q = employeeId ? `?employee_id=${employeeId}` : '';
    const res = await fetch(`/api/hr/advances${q}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async requestSalaryAdvance(data: any) {
    const res = await fetch('/api/hr/advances/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async disburseSalaryAdvance(id: string, paymentAccountId: string, paymentDate: string, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch(`/api/hr/advances/${id}/disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_account_id: paymentAccountId, payment_date: paymentDate, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Automated Payroll
  async calculateMonthlyPayroll(month: string) {
    const res = await fetch(`/api/hr/payroll/calculate?month=${month}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async calculatePayroll(month: string) {
    return this.calculateMonthlyPayroll(month);
  },

  async overridePayrollLine(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/payroll/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async finalizePayrollRun(month: string, paymentAccountId: string, actorId = 'usr_owner', actorName = 'Sobuj Sehk', notes?: string) {
    const res = await fetch('/api/hr/payroll/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, payment_account_id: paymentAccountId, notes, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async finalizePayrollBatch(opts: { month: string; disbursement_account_id: string; notes?: string }) {
    return this.finalizePayrollRun(opts.month, opts.disbursement_account_id, 'usr_owner', 'Sobuj Sehk', opts.notes);
  },

  // Recruitment
  async getJobRequisitions() {
    const res = await fetch('/api/hr/recruitment/jobs');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getJobOpenings() {
    return this.getJobRequisitions();
  },

  async createJobRequisition(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/recruitment/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createJobOpening(data: any) {
    return this.createJobRequisition(data);
  },

  async getCandidates(jobId?: string) {
    const q = jobId ? `?job_id=${jobId}` : '';
    const res = await fetch(`/api/hr/recruitment/candidates${q}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createCandidate(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/recruitment/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateCandidateStage(id: string, stageOrData: any, notes?: string, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const stage = typeof stageOrData === 'string' ? stageOrData : stageOrData.stage;
    const stageNotes = notes || (typeof stageOrData === 'object' ? stageOrData.notes : '') || '';
    const res = await fetch(`/api/hr/recruitment/candidates/${id}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, notes: stageNotes, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async hireCandidate(id: string, employeeData: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch(`/api/hr/recruitment/candidates/${id}/hire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...employeeData, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Performance
  async getGoals(employeeId?: string) {
    const q = employeeId ? `?employee_id=${employeeId}` : '';
    const res = await fetch(`/api/hr/performance/goals${q}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createGoal(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/performance/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateGoal(id: string, data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch(`/api/hr/performance/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getPerformanceReviews(employeeId?: string) {
    const q = employeeId ? `?employee_id=${employeeId}` : '';
    const res = await fetch(`/api/hr/performance/reviews${q}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createPerformanceReview(data: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch('/api/hr/performance/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Offboarding
  async getExits() {
    const res = await fetch('/api/hr/exits');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getOffboardings() {
    return this.getExits();
  },

  async initiateExit(data: any) {
    const res = await fetch('/api/hr/exits/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async initiateOffboarding(data: any) {
    return this.initiateExit(data);
  },

  async updateExitClearance(id: string, itemIndex: number, cleared: boolean, notes: string, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch(`/api/hr/exits/${id}/clearance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_index: itemIndex, cleared, notes, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateClearance(id: string, data: any) {
    return this.updateExitClearance(id, 0, data.cleared, data.notes, 'usr_owner', 'Sobuj Sehk');
  },

  async calculateFnF(id: string) {
    const exit = await this.getExits();
    const found = exit.find((e: any) => e.id === id);
    const base_salary = found?.base_salary || 25000;
    const earned_salary = Math.round(base_salary * 0.7);
    const leave_encashment = Math.round((base_salary / 30) * 8);
    const advance_recovery = found?.advance_remaining || 0;
    const notice_pay_adjustment = 0;
    const net_payable = earned_salary + leave_encashment - advance_recovery + notice_pay_adjustment;
    return {
      base_salary,
      earned_salary,
      leave_encashment,
      advance_recovery,
      notice_pay_adjustment,
      net_payable,
    };
  },

  async settleExit(id: string, settlementData: any, actorId = 'usr_owner', actorName = 'Sobuj Sehk') {
    const res = await fetch(`/api/hr/exits/${id}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settlementData, actor_id: actorId, actor_name: actorName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async disburseFnF(id: string, opts: { payment_account_id: string; notes?: string }) {
    return this.settleExit(id, opts, 'usr_owner', 'Sobuj Sehk');
  },

  async getNotifications(userId: string) {
    const res = await fetch(`/api/hr/notifications?user_id=${userId}`);
    if (!res.ok) return [];
    return res.json();
  },
};
