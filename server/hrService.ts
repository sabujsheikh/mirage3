import { db } from './db';
import {
  Department,
  Designation,
  Branch,
  Shift,
  Holiday,
  Employee,
  EmployeeDocument,
  EmployeeSalaryStructure,
  AttendanceRecord,
  AttendanceRegularization,
  LeaveType,
  LeaveRequest,
  LeaveAdjustment,
  SalaryAdvance,
  PayrollPeriodRun,
  PayrollRecord,
  JobRequisition,
  JobCandidate,
  EmployeeGoal,
  PerformanceReview,
  EmployeeExitRecord,
  HRNotification,
  HRDashboardSummary,
} from '../src/types';

export class HRService {
  public departments: Map<string, Department> = new Map();
  public designations: Map<string, Designation> = new Map();
  public branches: Map<string, Branch> = new Map();
  public shifts: Map<string, Shift> = new Map();
  public holidays: Map<string, Holiday> = new Map();
  public attendanceRecords: Map<string, AttendanceRecord> = new Map();
  public attendanceRegularizations: Map<string, AttendanceRegularization> = new Map();
  public leaveTypes: Map<string, LeaveType> = new Map();
  public leaveRequests: Map<string, LeaveRequest> = new Map();
  public leaveAdjustments: Map<string, LeaveAdjustment> = new Map();
  public salaryAdvances: Map<string, SalaryAdvance> = new Map();
  public payrollRuns: Map<string, PayrollPeriodRun> = new Map();
  public jobRequisitions: Map<string, JobRequisition> = new Map();
  public jobCandidates: Map<string, JobCandidate> = new Map();
  public employeeGoals: Map<string, EmployeeGoal> = new Map();
  public performanceReviews: Map<string, PerformanceReview> = new Map();
  public employeeExits: Map<string, EmployeeExitRecord> = new Map();

  public hrSettings = {
    employee_id_prefix: 'EMP-',
    working_days_per_month: 26,
    default_working_hours_per_day: 9,
    weekend_days: ['Friday'],
    currency: '৳',
    probation_months: 6,
    notice_period_days: 30,
  };

  constructor() {
    this.seedHRData();
  }

  // ============================================================================
  // SEED DATA: Realistic Bangladeshi Retail / Reseller Perfume Business Structure
  // ============================================================================
  private seedHRData() {
    // 1. Departments
    const depts: Department[] = [
      { id: 'dept_admin', name: 'Executive & Administration', code: 'ADM', description: 'Overall governance, strategy, and management', active: true, created_at: '2025-01-01' },
      { id: 'dept_sales', name: 'Showroom & Retail Sales', code: 'SLS', description: 'In-store fragrance testing, customer relations, and retail cash desk', active: true, created_at: '2025-01-01' },
      { id: 'dept_online', name: 'Messenger & Online Sales', code: 'ONL', description: 'Facebook Messenger chats, order confirmation, customer service', active: true, created_at: '2025-01-01' },
      { id: 'dept_logistics', name: 'Packing & Fulfillment Logistics', code: 'LOG', description: 'Order packing, barcode verification, courier handoffs, local deliveries', active: true, created_at: '2025-01-01' },
      { id: 'dept_finance', name: 'Accounts, Finance & Procurement', code: 'FIN', description: 'General ledger, payroll, Dubai supplier payables, bank reconciliations', active: true, created_at: '2025-01-01' },
      { id: 'dept_marketing', name: 'Marketing & Digital Media', code: 'MKT', description: 'Social media campaigns, perfume photography, influencer PR', active: true, created_at: '2025-01-01' },
    ];
    depts.forEach(d => this.departments.set(d.id, d));

    // 2. Designations
    const desigs: Designation[] = [
      { id: 'desig_owner', title: 'Managing Director / Owner', department_id: 'dept_admin', department_name: 'Executive & Administration', active: true },
      { id: 'desig_gm', title: 'General Manager & Chief Accountant', department_id: 'dept_finance', department_name: 'Accounts, Finance & Procurement', active: true },
      { id: 'desig_sales_lead', title: 'Showroom Sales Lead', department_id: 'dept_sales', department_name: 'Showroom & Retail Sales', active: true },
      { id: 'desig_sales_rep', title: 'Online Messenger Sales Specialist', department_id: 'dept_online', department_name: 'Messenger & Online Sales', active: true },
      { id: 'desig_packing_lead', title: 'Packing & Fulfillment Specialist', department_id: 'dept_logistics', department_name: 'Packing & Fulfillment Logistics', active: true },
      { id: 'desig_inhouse_rider', title: 'In-House Local Delivery Courier', department_id: 'dept_logistics', department_name: 'Packing & Fulfillment Logistics', active: true },
      { id: 'desig_media_exec', title: 'Digital Content & Fragrance Reviewer', department_id: 'dept_marketing', department_name: 'Marketing & Digital Media', active: true },
    ];
    desigs.forEach(d => this.designations.set(d.id, d));

    // 3. Branches / Physical Locations
    const branchesData: Branch[] = [
      { id: 'br_banani', name: 'Banani Flagship Showroom & HQ', code: 'BAN-01', address: 'House 47, Road 27, Banani, Dhaka-1213', phone: '01999033027', is_headquarters: true, active: true, created_at: '2025-01-01' },
      { id: 'br_dhanmondi', name: 'Dhanmondi Experience Hub', code: 'DHA-02', address: 'Plot 12, Road 7, Dhanmondi R/A, Dhaka-1205', phone: '01811223300', is_headquarters: false, active: true, created_at: '2025-06-01' },
      { id: 'br_warehouse', name: 'Tejgaon Central Fulfillment Hub', code: 'TEJ-03', address: '14/A Tejgaon Industrial Area, Dhaka-1208', phone: '01711000099', is_headquarters: false, active: true, created_at: '2025-02-01' },
    ];
    branchesData.forEach(b => this.branches.set(b.id, b));

    // 4. Shifts
    const shiftsData: Shift[] = [
      { id: 'sh_showroom', name: 'Showroom Retail Shift (10:00 AM - 07:00 PM)', start_time: '10:00', end_time: '19:00', late_grace_minutes: 15, half_day_threshold_minutes: 240, active: true, created_at: '2025-01-01' },
      { id: 'sh_office', name: 'Office & Accounts Shift (09:30 AM - 06:30 PM)', start_time: '09:30', end_time: '18:30', late_grace_minutes: 15, half_day_threshold_minutes: 240, active: true, created_at: '2025-01-01' },
      { id: 'sh_packing', name: 'Fulfillment & Dispatch Shift (11:00 AM - 08:00 PM)', start_time: '11:00', end_time: '20:00', late_grace_minutes: 20, half_day_threshold_minutes: 240, active: true, created_at: '2025-01-01' },
      { id: 'sh_evening', name: 'Evening Showroom Shift (01:00 PM - 10:00 PM)', start_time: '13:00', end_time: '22:00', late_grace_minutes: 15, half_day_threshold_minutes: 240, active: true, created_at: '2025-01-01' },
    ];
    shiftsData.forEach(s => this.shifts.set(s.id, s));

    // 5. Holidays (Bangladesh Calendar 2026)
    const holidaysData: Holiday[] = [
      { id: 'hol_1', name: 'International Mother Language Day', date: '2026-02-21', type: 'national', description: 'Shaheed Dibash' },
      { id: 'hol_2', name: 'Shab-e-Barat', date: '2026-03-05', type: 'religious', description: 'Night of Fortune' },
      { id: 'hol_3', name: 'Independence Day', date: '2026-03-26', type: 'national', description: 'National Independence & National Day' },
      { id: 'hol_4', name: 'Jumatul Wida & Shab-e-Qadr', date: '2026-03-27', type: 'religious', description: 'Holy Ramadan observances' },
      { id: 'hol_5', name: 'Eid-ul-Fitr (Day 1)', date: '2026-03-31', type: 'religious', description: 'Eid-ul-Fitr Festival' },
      { id: 'hol_6', name: 'Eid-ul-Fitr (Day 2)', date: '2026-04-01', type: 'religious', description: 'Eid-ul-Fitr Holiday' },
      { id: 'hol_7', name: 'Bengali New Year (Pohela Boishakh)', date: '2026-04-14', type: 'national', description: 'Bangla Noboborsho 1433' },
      { id: 'hol_8', name: 'May Day (Labor Day)', date: '2026-05-01', type: 'national', description: 'International Workers Day' },
      { id: 'hol_9', name: 'Eid-ul-Adha', date: '2026-06-06', type: 'religious', description: 'Sacrifice festival' },
    ];
    holidaysData.forEach(h => this.holidays.set(h.id, h));

    // 6. Leave Types & Policies
    const lTypes: LeaveType[] = [
      { id: 'lt_casual', name: 'Casual Leave (CL)', code: 'CL', days_allowed_per_year: 10, is_paid: true, accrual_frequency: 'yearly', can_carry_forward: false, color: '#3B82F6', active: true },
      { id: 'lt_sick', name: 'Sick / Medical Leave (SL)', code: 'SL', days_allowed_per_year: 14, is_paid: true, accrual_frequency: 'yearly', can_carry_forward: false, color: '#EF4444', active: true },
      { id: 'lt_earned', name: 'Earned / Annual Leave (EL)', code: 'EL', days_allowed_per_year: 15, is_paid: true, accrual_frequency: 'monthly', can_carry_forward: true, max_carry_forward_days: 10, color: '#10B981', active: true },
      { id: 'lt_unpaid', name: 'Leave Without Pay (LWP)', code: 'LWP', days_allowed_per_year: 30, is_paid: false, accrual_frequency: 'yearly', can_carry_forward: false, color: '#64748B', active: true },
      { id: 'lt_maternity', name: 'Maternity Leave', code: 'ML', days_allowed_per_year: 112, is_paid: true, accrual_frequency: 'yearly', can_carry_forward: false, color: '#EC4899', active: true },
      { id: 'lt_paternity', name: 'Paternity Leave', code: 'PL', days_allowed_per_year: 5, is_paid: true, accrual_frequency: 'yearly', can_carry_forward: false, color: '#8B5CF6', active: true },
      { id: 'lt_bereavement', name: 'Bereavement Leave', code: 'BL', days_allowed_per_year: 3, is_paid: true, accrual_frequency: 'yearly', can_carry_forward: false, color: '#F59E0B', active: true },
    ];
    lTypes.forEach(lt => this.leaveTypes.set(lt.id, lt));

    // 7. Enrich Existing Seed Employees in db.employees
    this.enrichSeedEmployees();

    // 8. Seed Attendance Records for current month
    this.seedAttendanceHistory();

    // 9. Seed Leave Requests & Adjustments
    this.seedLeaveData();

    // 10. Seed Active Salary Advances & Accounting Integration
    this.seedSalaryAdvances();

    // 11. Seed Recruitment Requisitions & Pipeline
    this.seedRecruitment();

    // 12. Seed Performance Goals & Reviews
    this.seedPerformance();
  }

  private enrichSeedEmployees() {
    // EMP-001: Tanvir Ahmed
    const e1 = db.employees.get('EMP-001');
    if (e1) {
      Object.assign(e1, {
        user_id: 'usr_mgr',
        employee_id_code: 'EMP-001',
        photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
        designation_id: 'desig_sales_lead',
        department_id: 'dept_sales',
        department_name: 'Showroom & Retail Sales',
        branch_id: 'br_banani',
        branch_name: 'Banani Flagship Showroom & HQ',
        reporting_manager_id: 'EMP-003',
        reporting_manager_name: 'Arif Rahman',
        employment_type: 'full_time',
        employment_status: 'active',
        probation_end_date: '2025-12-01',
        address: 'House 12, Road 4, Sector 7, Uttara, Dhaka',
        emergency_contact: { name: 'Nasir Ahmed (Brother)', relation: 'Brother', phone: '01711889900' },
        nid_passport: '5512398471209',
        dob: '1995-04-12',
        gender: 'male',
        marital_status: 'married',
        shift_id: 'sh_showroom',
        shift_name: 'Showroom Retail Shift (10:00 AM - 07:00 PM)',
        bank_name: 'City Bank Ltd.',
        bank_routing_no: '225272654',
        salary_structure: {
          basic: 18000,
          house_rent: 7000,
          medical: 3000,
          conveyance: 2000,
          other_allowance: 0,
          tax_deduction: 0,
          provident_fund: 1500,
          other_deductions: 0,
        },
        leave_balances: {
          lt_casual: 8,
          lt_sick: 12,
          lt_earned: 14,
          lt_unpaid: 30,
        },
        active_loan_balance: 0,
        documents: [
          { id: 'doc_101', title: 'National NID Card (Smart Card)', doc_type: 'nid_passport', file_name: 'nid_tanvir_smartcard.pdf', uploaded_at: '2025-06-01' },
          { id: 'doc_102', title: 'Permanent Employment Contract', doc_type: 'contract', file_name: 'mirage_appointment_tanvir.pdf', uploaded_at: '2025-06-01', expiry_date: '2027-05-31' },
          { id: 'doc_103', title: 'BBA Graduation Certificate', doc_type: 'certificate', file_name: 'tanvir_bba_cert.pdf', uploaded_at: '2025-06-01' },
        ],
      });
    }

    // EMP-002: Kalam Hossain
    const e2 = db.employees.get('EMP-002');
    if (e2) {
      Object.assign(e2, {
        user_id: 'usr_pack',
        employee_id_code: 'EMP-002',
        photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
        designation_id: 'desig_packing_lead',
        department_id: 'dept_logistics',
        department_name: 'Packing & Fulfillment Logistics',
        branch_id: 'br_warehouse',
        branch_name: 'Tejgaon Central Fulfillment Hub',
        reporting_manager_id: 'EMP-003',
        reporting_manager_name: 'Arif Rahman',
        employment_type: 'full_time',
        employment_status: 'active',
        address: '54/2 Khilgaon Chowdhury Para, Dhaka',
        emergency_contact: { name: 'Amena Begum (Spouse)', relation: 'Spouse', phone: '01711223399' },
        nid_passport: '8812903481203',
        dob: '1998-09-20',
        gender: 'male',
        marital_status: 'married',
        shift_id: 'sh_packing',
        shift_name: 'Fulfillment & Dispatch Shift (11:00 AM - 08:00 PM)',
        salary_structure: {
          basic: 14000,
          house_rent: 5000,
          medical: 1500,
          conveyance: 1500,
          other_allowance: 0,
          tax_deduction: 0,
          provident_fund: 1000,
          other_deductions: 0,
        },
        leave_balances: {
          lt_casual: 6,
          lt_sick: 10,
          lt_earned: 11,
          lt_unpaid: 30,
        },
        active_loan_balance: 6000, // Active salary advance remaining
        documents: [
          { id: 'doc_201', title: 'National Identity Card', doc_type: 'nid_passport', file_name: 'kalam_nid_scan.pdf', uploaded_at: '2025-08-15' },
          { id: 'doc_202', title: 'Job Offer & Agreement', doc_type: 'contract', file_name: 'appointment_kalam.pdf', uploaded_at: '2025-08-15' },
        ],
      });
    }

    // EMP-003: Arif Rahman (GM & Accountant)
    const e3 = db.employees.get('EMP-003');
    if (e3) {
      Object.assign(e3, {
        user_id: 'usr_gm',
        employee_id_code: 'EMP-003',
        photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&q=80',
        designation_id: 'desig_gm',
        department_id: 'dept_finance',
        department_name: 'Accounts, Finance & Procurement',
        branch_id: 'br_banani',
        branch_name: 'Banani Flagship Showroom & HQ',
        reporting_manager_id: 'usr_owner',
        reporting_manager_name: 'Sobuj Sehk',
        employment_type: 'full_time',
        employment_status: 'active',
        address: 'Apartment 4B, Green Road, Dhanmondi, Dhaka',
        emergency_contact: { name: 'Fatema Rahman (Wife)', relation: 'Spouse', phone: '01711776655' },
        nid_passport: '1987123908123',
        dob: '1987-11-05',
        gender: 'male',
        marital_status: 'married',
        shift_id: 'sh_office',
        shift_name: 'Office & Accounts Shift (09:30 AM - 06:30 PM)',
        bank_name: 'City Bank Ltd.',
        bank_routing_no: '225272654',
        salary_structure: {
          basic: 28000,
          house_rent: 10000,
          medical: 4000,
          conveyance: 3000,
          other_allowance: 0,
          tax_deduction: 1500,
          provident_fund: 2000,
          other_deductions: 0,
        },
        leave_balances: {
          lt_casual: 9,
          lt_sick: 14,
          lt_earned: 15,
          lt_unpaid: 30,
        },
        active_loan_balance: 0,
        documents: [
          { id: 'doc_301', title: 'National Identity Card (Smart NID)', doc_type: 'nid_passport', file_name: 'arif_nid.pdf', uploaded_at: '2025-01-10' },
          { id: 'doc_302', title: 'Executive Employment Contract', doc_type: 'contract', file_name: 'contract_arif_gm.pdf', uploaded_at: '2025-01-10' },
          { id: 'doc_303', title: 'ICAB Chartered Accountancy Certificate', doc_type: 'certificate', file_name: 'ca_inter_cert.pdf', uploaded_at: '2025-01-10' },
        ],
      });
    }

    // EMP-004: Shamim Reza (Online Messenger Sales Rep)
    const e4 = db.employees.get('EMP-004');
    if (e4) {
      Object.assign(e4, {
        employee_id_code: 'EMP-004',
        photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80',
        designation_id: 'desig_sales_rep',
        department_id: 'dept_online',
        department_name: 'Messenger & Online Sales',
        branch_id: 'br_banani',
        branch_name: 'Banani Flagship Showroom & HQ',
        reporting_manager_id: 'EMP-001',
        reporting_manager_name: 'Tanvir Ahmed',
        employment_type: 'full_time',
        employment_status: 'active',
        probation_end_date: '2026-04-01',
        address: 'Badda Link Road, Gulshan-1, Dhaka',
        emergency_contact: { name: 'Mizanur Reza (Father)', relation: 'Father', phone: '01811554433' },
        nid_passport: '9920194812034',
        dob: '2000-02-14',
        gender: 'male',
        marital_status: 'single',
        shift_id: 'sh_showroom',
        shift_name: 'Showroom Retail Shift (10:00 AM - 07:00 PM)',
        salary_structure: {
          basic: 13000,
          house_rent: 4500,
          medical: 1500,
          conveyance: 1000,
          other_allowance: 0,
          tax_deduction: 0,
          provident_fund: 1000,
          other_deductions: 0,
        },
        leave_balances: {
          lt_casual: 7,
          lt_sick: 11,
          lt_earned: 10,
          lt_unpaid: 30,
        },
        active_loan_balance: 0,
        documents: [
          { id: 'doc_401', title: 'National NID Card', doc_type: 'nid_passport', file_name: 'shamim_nid.pdf', uploaded_at: '2025-10-01' },
          { id: 'doc_402', title: 'Appointment Letter', doc_type: 'contract', file_name: 'shamim_appointment.pdf', uploaded_at: '2025-10-01' },
        ],
      });
    }
  }

  private seedAttendanceHistory() {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const employees = Array.from(db.employees.values());

    dates.forEach(date => {
      const dayOfWeek = new Date(date).getDay();
      const isFriday = dayOfWeek === 5; // Friday weekend in BD

      employees.forEach(emp => {
        if (isFriday) {
          // Weekend - no attendance required
          return;
        }

        const id = `ATT-${emp.id}-${date}`;
        let status: AttendanceRecord['status'] = 'present';
        let check_in = '09:55';
        let check_out = '19:05';
        let is_manual = false;
        let correction_reason: string | undefined = undefined;
        let punch_in_method: AttendanceRecord['punch_in_method'] = 'biometric';

        if (emp.id === 'EMP-004' && date === dates[dates.length - 2]) {
          // Late arrival example
          status = 'late';
          check_in = '10:28';
          check_out = '19:10';
        } else if (emp.id === 'EMP-002' && date === dates[dates.length - 3]) {
          // Manual fallback example (biometric missed punch corrected by HR)
          status = 'present';
          check_in = '11:00';
          check_out = '20:05';
          is_manual = true;
          correction_reason = 'Biometric reader network glitch at Tejgaon Hub; verified on showroom CCTV log';
          punch_in_method = 'manual';
        }

        this.attendanceRecords.set(id, {
          id,
          employee_id: emp.id,
          employee_name: emp.name,
          date,
          check_in,
          check_out,
          status,
          shift_id: emp.shift_id || 'sh_showroom',
          shift_name: emp.shift_name || 'Showroom Retail Shift',
          is_manual,
          correction_reason,
          punch_in_method,
          created_by: 'system',
          created_at: `${date}T${check_in}:00Z`,
        });
      });
    });
  }

  private seedLeaveData() {
    // Sample Pending Manager Leave Request
    const req1: LeaveRequest = {
      id: 'LV-2026-001',
      employee_id: 'EMP-004',
      employee_name: 'Shamim Reza',
      leave_type_id: 'lt_casual',
      leave_type_name: 'Casual Leave (CL)',
      start_date: '2026-03-02',
      end_date: '2026-03-03',
      total_days: 2,
      reason: 'Attending family wedding ceremony in Gazipur',
      status: 'pending_manager',
      created_at: new Date().toISOString(),
    };
    this.leaveRequests.set(req1.id, req1);

    // Sample Approved Leave Request
    const req2: LeaveRequest = {
      id: 'LV-2026-002',
      employee_id: 'EMP-001',
      employee_name: 'Tanvir Ahmed',
      leave_type_id: 'lt_sick',
      leave_type_name: 'Sick / Medical Leave (SL)',
      start_date: '2026-02-15',
      end_date: '2026-02-16',
      total_days: 2,
      reason: 'Acute viral fever and physician consultation',
      status: 'approved',
      manager_approval_by: 'usr_gm',
      manager_approval_at: '2026-02-14T11:00:00Z',
      manager_notes: 'Medical prescription verified. Approved.',
      hr_approval_by: 'usr_owner',
      hr_approval_at: '2026-02-14T14:30:00Z',
      hr_notes: 'Approved sick leave with pay.',
      created_at: '2026-02-14T09:30:00Z',
    };
    this.leaveRequests.set(req2.id, req2);

    // Sample Manual Leave Balance Adjustment
    const adj1: LeaveAdjustment = {
      id: 'LADJ-101',
      employee_id: 'EMP-001',
      employee_name: 'Tanvir Ahmed',
      leave_type_id: 'lt_earned',
      leave_type_name: 'Earned / Annual Leave (EL)',
      adjustment_days: 2,
      reason: 'Earned compensatory leave for working on Pohela Boishakh fragrance exhibition shift',
      adjusted_by: 'usr_owner',
      adjusted_by_name: 'Sobuj Sehk',
      created_at: '2026-01-15T12:00:00Z',
    };
    this.leaveAdjustments.set(adj1.id, adj1);
  }

  private seedSalaryAdvances() {
    // Disbursed Salary Advance for Kalam Hossain (EMP-002)
    // Disbursed ৳10,000, ৳2,000 deducted over 2 months, ৳6,000 remaining
    const adv1: SalaryAdvance = {
      id: 'ADV-2026-001',
      advance_number: 'ADV-2026-001',
      employee_id: 'EMP-002',
      employee_name: 'Kalam Hossain',
      amount: 10000,
      disbursed_amount: 10000,
      remaining_balance: 6000,
      monthly_installment: 2000,
      repayment_months: 5,
      deducted_so_far: 4000,
      reason: 'Urgent medical expenses for mother hospital admission',
      status: 'disbursed',
      disbursement_account_id: 'acc_cash',
      disbursement_account_name: 'Cash in Hand (Showroom Till)',
      disbursement_date: '2025-12-15',
      journal_entry_id: 'JE-ADV-1001',
      created_by: 'usr_owner',
      created_at: '2025-12-15T10:00:00Z',
    };
    this.salaryAdvances.set(adv1.id, adv1);
  }

  private seedRecruitment() {
    const req1: JobRequisition = {
      id: 'JOB-2026-001',
      title: 'Luxury Fragrance Consultant & Decant Specialist',
      department_id: 'dept_sales',
      department_name: 'Showroom & Retail Sales',
      openings: 2,
      employment_type: 'Full-time',
      experience_required: '1-2 years retail perfume sales',
      salary_range: '৳22,000 - ৳26,000',
      description: 'Consult walk-in customers on niche Middle Eastern and French designer perfumes at Banani showroom.',
      status: 'open',
      created_at: '2026-02-01',
    };
    this.jobRequisitions.set(req1.id, req1);

    const cand1: JobCandidate = {
      id: 'CAND-101',
      job_requisition_id: 'JOB-2026-001',
      job_title: 'Luxury Fragrance Consultant & Decant Specialist',
      name: 'Rashedul Hasan',
      email: 'rashed.hasan@gmail.com',
      phone: '01819998877',
      current_stage: 'interview',
      interview_date: '2026-03-05T15:00:00',
      rating: 4,
      notes: 'Strong olfactory knowledge of Armaf, Afnan, Lattafa lines. Articulate and pleasant demeanor.',
      applied_at: '2026-02-18',
    };

    const cand2: JobCandidate = {
      id: 'CAND-102',
      job_requisition_id: 'JOB-2026-001',
      job_title: 'Luxury Fragrance Consultant & Decant Specialist',
      name: 'Nusrat Jahan',
      email: 'nusrat.jahan@hotmail.com',
      phone: '01712334455',
      current_stage: 'screening',
      rating: 5,
      notes: 'Worked 2 years at Shajgoj fragrance counter. Fluent in English and Bengali.',
      applied_at: '2026-02-22',
    };

    this.jobCandidates.set(cand1.id, cand1);
    this.jobCandidates.set(cand2.id, cand2);
  }

  private seedPerformance() {
    const goal1: EmployeeGoal = {
      id: 'GOAL-101',
      employee_id: 'EMP-001',
      employee_name: 'Tanvir Ahmed',
      title: 'Achieve ৳1,500,000 Monthly In-Store Showroom Revenue',
      description: 'Focus on high-margin niche Arabic extraits (Khadlaj, Rasasi Hawas, Armaf Club De Nuit) and VIP customer repeat visits.',
      target_date: '2026-03-31',
      status: 'in_progress',
      progress_percentage: 65,
      created_at: '2026-01-01',
    };
    this.employeeGoals.set(goal1.id, goal1);

    const rev1: PerformanceReview = {
      id: 'REV-2025-Q4',
      employee_id: 'EMP-002',
      employee_name: 'Kalam Hossain',
      cycle: '2025-Q4',
      reviewer_id: 'usr_gm',
      reviewer_name: 'Arif Rahman',
      rating: 5,
      strengths: 'Exceptional barcode scan accuracy. Zero dispatch mistakes during November Black Friday campaign.',
      areas_for_improvement: 'Learn to use Steadfast API batch tracking panel for bulk parcel reconciliation.',
      feedback: 'Outstanding packaging speed and reliability. Recommended for performance bonus.',
      status: 'acknowledged',
      created_at: '2026-01-10',
    };
    this.performanceReviews.set(rev1.id, rev1);
  }

  // ============================================================================
  // ORGANIZATION STRUCTURE API
  // ============================================================================
  public getDepartments(): Department[] {
    return Array.from(this.departments.values());
  }

  public createDepartment(data: Partial<Department>, actor_id: string, actor_name: string): Department {
    const id = `dept_${Date.now()}`;
    const dept: Department = {
      id,
      name: data.name || 'New Department',
      code: data.code || 'DEPT',
      description: data.description,
      parent_department_id: data.parent_department_id,
      parent_department_name: data.parent_department_name,
      head_employee_id: data.head_employee_id,
      head_employee_name: data.head_employee_name,
      active: true,
      created_at: new Date().toISOString().slice(0, 10),
    };
    this.departments.set(dept.id, dept);
    db.logAudit(actor_id, actor_name, 'hr_department_created', 'department', dept.id, `Created department: ${dept.name} (${dept.code})`);
    return dept;
  }

  public updateDepartment(id: string, data: Partial<Department>, actor_id: string, actor_name: string): Department {
    const dept = this.departments.get(id);
    if (!dept) throw new Error(`Department not found: ${id}`);
    Object.assign(dept, data);
    db.logAudit(actor_id, actor_name, 'hr_department_updated', 'department', id, `Updated department: ${dept.name}`);
    return dept;
  }

  public getDesignations(): Designation[] {
    return Array.from(this.designations.values());
  }

  public createDesignation(data: Partial<Designation>, actor_id: string, actor_name: string): Designation {
    const id = `desig_${Date.now()}`;
    const desig: Designation = {
      id,
      title: data.title || 'New Designation',
      department_id: data.department_id,
      department_name: data.department_name,
      description: data.description,
      active: true,
      created_at: new Date().toISOString().slice(0, 10),
    };
    this.designations.set(desig.id, desig);
    db.logAudit(actor_id, actor_name, 'hr_designation_created', 'designation', desig.id, `Created designation: ${desig.title}`);
    return desig;
  }

  public updateDesignation(id: string, data: Partial<Designation>, actor_id: string, actor_name: string): Designation {
    const desig = this.designations.get(id);
    if (!desig) throw new Error(`Designation not found: ${id}`);
    Object.assign(desig, data);
    db.logAudit(actor_id, actor_name, 'hr_designation_updated', 'designation', id, `Updated designation: ${desig.title}`);
    return desig;
  }

  public getBranches(): Branch[] {
    return Array.from(this.branches.values());
  }

  public createBranch(data: Partial<Branch>, actor_id: string, actor_name: string): Branch {
    const id = `br_${Date.now()}`;
    const branch: Branch = {
      id,
      name: data.name || 'New Branch',
      code: data.code || 'BR',
      address: data.address || '',
      phone: data.phone,
      is_headquarters: Boolean(data.is_headquarters),
      active: true,
      created_at: new Date().toISOString().slice(0, 10),
    };
    this.branches.set(branch.id, branch);
    db.logAudit(actor_id, actor_name, 'hr_branch_created', 'branch', branch.id, `Created branch: ${branch.name} (${branch.code})`);
    return branch;
  }

  public updateBranch(id: string, data: Partial<Branch>, actor_id: string, actor_name: string): Branch {
    const branch = this.branches.get(id);
    if (!branch) throw new Error(`Branch not found: ${id}`);
    Object.assign(branch, data);
    db.logAudit(actor_id, actor_name, 'hr_branch_updated', 'branch', id, `Updated branch: ${branch.name}`);
    return branch;
  }

  public getShifts(): Shift[] {
    return Array.from(this.shifts.values());
  }

  public createShift(data: Partial<Shift>, actor_id: string, actor_name: string): Shift {
    const id = `sh_${Date.now()}`;
    const shift: Shift = {
      id,
      name: data.name || 'Custom Shift',
      start_time: data.start_time || '10:00',
      end_time: data.end_time || '19:00',
      late_grace_minutes: Number(data.late_grace_minutes || 15),
      half_day_threshold_minutes: Number(data.half_day_threshold_minutes || 240),
      active: true,
      created_at: new Date().toISOString().slice(0, 10),
    };
    this.shifts.set(shift.id, shift);
    db.logAudit(actor_id, actor_name, 'hr_shift_created', 'shift', shift.id, `Created shift: ${shift.name} (${shift.start_time}-${shift.end_time})`);
    return shift;
  }

  public updateShift(id: string, data: Partial<Shift>, actor_id: string, actor_name: string): Shift {
    const shift = this.shifts.get(id);
    if (!shift) throw new Error(`Shift not found: ${id}`);
    Object.assign(shift, data);
    db.logAudit(actor_id, actor_name, 'hr_shift_updated', 'shift', id, `Updated shift: ${shift.name}`);
    return shift;
  }

  public getHolidays(): Holiday[] {
    return Array.from(this.holidays.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  public createHoliday(data: Partial<Holiday>, actor_id: string, actor_name: string): Holiday {
    const id = `hol_${Date.now()}`;
    const holiday: Holiday = {
      id,
      name: data.name || 'Holiday',
      date: data.date || new Date().toISOString().slice(0, 10),
      type: data.type || 'company',
      description: data.description,
    };
    this.holidays.set(holiday.id, holiday);
    db.logAudit(actor_id, actor_name, 'hr_holiday_created', 'holiday', holiday.id, `Added holiday: ${holiday.name} on ${holiday.date}`);
    return holiday;
  }

  public deleteHoliday(id: string, actor_id: string, actor_name: string): boolean {
    const hol = this.holidays.get(id);
    if (!hol) return false;
    this.holidays.delete(id);
    db.logAudit(actor_id, actor_name, 'hr_holiday_deleted', 'holiday', id, `Removed holiday: ${hol.name} (${hol.date})`);
    return true;
  }

  // ============================================================================
  // EMPLOYEE MASTER & DIRECTORY API
  // ============================================================================
  public getEmployees(params?: {
    search?: string;
    department_id?: string;
    branch_id?: string;
    employment_status?: string;
    employment_type?: string;
    page?: number;
    limit?: number;
  }): { items: Employee[]; total: number; page: number; limit: number } {
    let list = Array.from(db.employees.values());

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.employee_id_code && e.employee_id_code.toLowerCase().includes(q)) ||
        e.phone.includes(q) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        e.designation.toLowerCase().includes(q)
      );
    }

    if (params?.department_id && params.department_id !== 'all') {
      list = list.filter(e => e.department_id === params.department_id);
    }

    if (params?.branch_id && params.branch_id !== 'all') {
      list = list.filter(e => e.branch_id === params.branch_id);
    }

    if (params?.employment_status && params.employment_status !== 'all') {
      list = list.filter(e => e.employment_status === params.employment_status);
    }

    if (params?.employment_type && params.employment_type !== 'all') {
      list = list.filter(e => e.employment_type === params.employment_type);
    }

    const total = list.length;
    const page = Math.max(1, Number(params?.page || 1));
    const limit = Math.max(1, Number(params?.limit || 50));
    const start = (page - 1) * limit;
    const items = list.slice(start, start + limit);

    return { items, total, page, limit };
  }

  public getEmployeeById(id: string): Employee | undefined {
    return db.employees.get(id);
  }

  public createEmployee(data: Partial<Employee>, actor_id: string, actor_name: string): Employee {
    const count = db.employees.size + 1;
    const code = `${this.hrSettings.employee_id_prefix}${String(count).padStart(3, '0')}`;
    const id = code;

    const baseSalary = Number(data.base_salary || 20000);
    const salaryStructure: EmployeeSalaryStructure = data.salary_structure || {
      basic: Math.round(baseSalary * 0.6),
      house_rent: Math.round(baseSalary * 0.25),
      medical: Math.round(baseSalary * 0.1),
      conveyance: Math.round(baseSalary * 0.05),
      other_allowance: 0,
      tax_deduction: 0,
      provident_fund: 0,
      other_deductions: 0,
    };

    const initialLeaveBalances: Record<string, number> = {};
    this.leaveTypes.forEach(lt => {
      initialLeaveBalances[lt.id] = lt.days_allowed_per_year;
    });

    const emp: Employee = {
      id,
      employee_id_code: code,
      name: data.name || 'New Staff',
      phone: data.phone || '',
      email: data.email,
      photo_url: data.photo_url || '',
      designation: data.designation || 'Staff Member',
      designation_id: data.designation_id,
      role: data.role || 'Showroom & Sales',
      department_id: data.department_id,
      department_name: data.department_name,
      branch_id: data.branch_id,
      branch_name: data.branch_name,
      reporting_manager_id: data.reporting_manager_id,
      reporting_manager_name: data.reporting_manager_name,
      employment_type: data.employment_type || 'full_time',
      employment_status: data.employment_status || 'active',
      base_salary: baseSalary,
      disbursement_method: data.disbursement_method || 'bank',
      bank_account_no: data.bank_account_no,
      bank_name: data.bank_name,
      bank_routing_no: data.bank_routing_no,
      bkash_number: data.bkash_number,
      joined_date: data.joined_date || new Date().toISOString().slice(0, 10),
      probation_end_date: data.probation_end_date,
      contract_end_date: data.contract_end_date,
      address: data.address,
      emergency_contact: data.emergency_contact,
      nid_passport: data.nid_passport,
      dob: data.dob,
      gender: data.gender || 'male',
      marital_status: data.marital_status || 'single',
      shift_id: data.shift_id || 'sh_showroom',
      shift_name: data.shift_name || 'Showroom Retail Shift',
      salary_structure: salaryStructure,
      leave_balances: initialLeaveBalances,
      active_loan_balance: 0,
      documents: data.documents || [],
      active: true,
    };

    db.employees.set(emp.id, emp);
    db.logAudit(actor_id, actor_name, 'hr_employee_created', 'employee', emp.id, `Enrolled employee: ${emp.name} (${emp.employee_id_code}, Base: ৳${emp.base_salary.toLocaleString()})`);
    return emp;
  }

  public updateEmployee(id: string, data: Partial<Employee>, actor_id: string, actor_name: string): Employee {
    const emp = db.employees.get(id);
    if (!emp) throw new Error(`Employee not found: ${id}`);
    Object.assign(emp, data);
    db.logAudit(actor_id, actor_name, 'hr_employee_updated', 'employee', id, `Updated profile for: ${emp.name}`);
    return emp;
  }

  public addEmployeeDocument(id: string, doc: Omit<EmployeeDocument, 'id' | 'uploaded_at'>, actor_id: string, actor_name: string): EmployeeDocument {
    const emp = db.employees.get(id);
    if (!emp) throw new Error(`Employee not found: ${id}`);
    if (!emp.documents) emp.documents = [];

    const newDoc: EmployeeDocument = {
      ...doc,
      id: `doc_${Date.now()}`,
      uploaded_at: new Date().toISOString().slice(0, 10),
    };
    emp.documents.push(newDoc);
    db.logAudit(actor_id, actor_name, 'hr_document_uploaded', 'employee', id, `Uploaded document: ${newDoc.title} for ${emp.name}`);
    return newDoc;
  }

  public removeEmployeeDocument(id: string, docId: string, actor_id: string, actor_name: string): boolean {
    const emp = db.employees.get(id);
    if (!emp || !emp.documents) return false;
    emp.documents = emp.documents.filter(d => d.id !== docId);
    db.logAudit(actor_id, actor_name, 'hr_document_removed', 'employee', id, `Removed document ${docId} from ${emp.name}`);
    return true;
  }

  // ============================================================================
  // ATTENDANCE & SHIFTS API
  // ============================================================================
  public getAttendance(params?: {
    date?: string;
    employee_id?: string;
    month?: string; // YYYY-MM
    start_date?: string;
    end_date?: string;
  }): AttendanceRecord[] {
    let list = Array.from(this.attendanceRecords.values());

    if (params?.date) {
      list = list.filter(a => a.date === params.date);
    }
    if (params?.employee_id) {
      list = list.filter(a => a.employee_id === params.employee_id);
    }
    if (params?.month) {
      list = list.filter(a => a.date.startsWith(params.month!));
    }
    if (params?.start_date && params?.end_date) {
      list = list.filter(a => a.date >= params.start_date! && a.date <= params.end_date!);
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }

  public clockPunch(params: {
    employee_id: string;
    punch_type: 'in' | 'out';
    method: 'web' | 'mobile' | 'biometric';
    timestamp?: string;
    notes?: string;
  }): AttendanceRecord {
    const emp = db.employees.get(params.employee_id);
    if (!emp) throw new Error(`Employee not found: ${params.employee_id}`);

    const now = params.timestamp ? new Date(params.timestamp) : new Date();
    const date = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5); // "HH:MM"

    const recordId = `ATT-${emp.id}-${date}`;
    let record = this.attendanceRecords.get(recordId);

    const shift = emp.shift_id ? this.shifts.get(emp.shift_id) : Array.from(this.shifts.values())[0];
    const shiftStartTime = shift ? shift.start_time : '10:00';
    const lateGrace = shift ? shift.late_grace_minutes : 15;

    if (!record) {
      // First punch of the day
      let status: AttendanceRecord['status'] = 'present';

      // Check if late:
      const [shiftH, shiftM] = shiftStartTime.split(':').map(Number);
      const [punchH, punchM] = timeStr.split(':').map(Number);
      const shiftMinutes = shiftH * 60 + shiftM;
      const punchMinutes = punchH * 60 + punchM;

      if (punchMinutes > shiftMinutes + lateGrace) {
        status = 'late';
      }

      record = {
        id: recordId,
        employee_id: emp.id,
        employee_name: emp.name,
        date,
        check_in: timeStr,
        status,
        shift_id: shift?.id,
        shift_name: shift?.name,
        is_manual: false,
        punch_in_method: params.method,
        notes: params.notes,
        created_by: emp.name,
        created_at: now.toISOString(),
      };
      this.attendanceRecords.set(recordId, record);
    } else {
      // Existing record (e.g. punch out)
      if (params.punch_type === 'out') {
        record.check_out = timeStr;
        record.updated_at = now.toISOString();

        // Calculate half-day if applicable:
        if (record.check_in && shift) {
          const [inH, inM] = record.check_in.split(':').map(Number);
          const [outH, outM] = timeStr.split(':').map(Number);
          const workedMinutes = (outH * 60 + outM) - (inH * 60 + inM);
          if (workedMinutes < shift.half_day_threshold_minutes && record.status !== 'late') {
            record.status = 'half_day';
          }
        }
      } else {
        record.check_in = timeStr;
        record.updated_at = now.toISOString();
      }
    }

    db.logAudit(
      emp.id,
      emp.name,
      'attendance_punched',
      'attendance',
      record.id,
      `Clock-${params.punch_type.toUpperCase()} recorded for ${emp.name} at ${timeStr} via ${params.method} (${record.status})`
    );

    return record;
  }

  // Manual fallback path for attendance (Section: Manual Fallback)
  public manualAttendance(params: {
    employee_id: string;
    date: string;
    check_in?: string;
    check_out?: string;
    status: AttendanceRecord['status'];
    correction_reason: string;
    actor_id: string;
    actor_name: string;
  }): AttendanceRecord {
    if (!params.correction_reason || params.correction_reason.trim().length < 5) {
      throw new Error('Mandatory correction reason (minimum 5 characters) required for manual attendance entries.');
    }

    const emp = db.employees.get(params.employee_id);
    if (!emp) throw new Error(`Employee not found: ${params.employee_id}`);

    const recordId = `ATT-${emp.id}-${params.date}`;
    const record: AttendanceRecord = {
      id: recordId,
      employee_id: emp.id,
      employee_name: emp.name,
      date: params.date,
      check_in: params.check_in || '10:00',
      check_out: params.check_out || '19:00',
      status: params.status,
      shift_id: emp.shift_id,
      shift_name: emp.shift_name,
      is_manual: true,
      correction_reason: params.correction_reason,
      punch_in_method: 'manual',
      created_by: params.actor_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.attendanceRecords.set(recordId, record);
    db.logAudit(
      params.actor_id,
      params.actor_name,
      'attendance_manual_correction',
      'attendance',
      record.id,
      `Manual Attendance recorded for ${emp.name} on ${params.date}: Status ${params.status}. Reason: "${params.correction_reason}"`
    );

    return record;
  }

  public getRegularizations(params?: { status?: string; employee_id?: string }): AttendanceRegularization[] {
    let list = Array.from(this.attendanceRegularizations.values());
    if (params?.status && params.status !== 'all') {
      list = list.filter(r => r.status === params.status);
    }
    if (params?.employee_id) {
      list = list.filter(r => r.employee_id === params.employee_id);
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public requestRegularization(params: {
    employee_id: string;
    date: string;
    proposed_check_in: string;
    proposed_check_out: string;
    reason: string;
  }): AttendanceRegularization {
    const emp = db.employees.get(params.employee_id);
    if (!emp) throw new Error(`Employee not found: ${params.employee_id}`);

    const id = `REG-${Date.now()}`;
    const reg: AttendanceRegularization = {
      id,
      employee_id: emp.id,
      employee_name: emp.name,
      date: params.date,
      proposed_check_in: params.proposed_check_in,
      proposed_check_out: params.proposed_check_out,
      reason: params.reason,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    this.attendanceRegularizations.set(id, reg);
    db.logAudit(emp.id, emp.name, 'attendance_reg_requested', 'attendance_reg', id, `Requested attendance regularization for ${params.date}: "${params.reason}"`);
    return reg;
  }

  public reviewRegularization(params: {
    id: string;
    status: 'approved' | 'rejected';
    review_notes?: string;
    actor_id: string;
    actor_name: string;
  }): AttendanceRegularization {
    const reg = this.attendanceRegularizations.get(params.id);
    if (!reg) throw new Error(`Regularization request not found: ${params.id}`);

    reg.status = params.status;
    reg.reviewed_by = params.actor_id;
    reg.reviewed_by_name = params.actor_name;
    reg.reviewed_at = new Date().toISOString();
    reg.review_notes = params.review_notes;

    if (params.status === 'approved') {
      // Auto-update attendance record with is_manual = true
      this.manualAttendance({
        employee_id: reg.employee_id,
        date: reg.date,
        check_in: reg.proposed_check_in,
        check_out: reg.proposed_check_out,
        status: 'present',
        correction_reason: `Approved Regularization: ${params.review_notes || reg.reason}`,
        actor_id: params.actor_id,
        actor_name: params.actor_name,
      });
    }

    db.logAudit(
      params.actor_id,
      params.actor_name,
      'attendance_reg_reviewed',
      'attendance_reg',
      reg.id,
      `Regularization for ${reg.employee_name} (${reg.date}) was ${params.status}. Notes: ${params.review_notes || 'None'}`
    );

    return reg;
  }

  // ============================================================================
  // LEAVE MANAGEMENT API
  // ============================================================================
  public getLeaveTypes(): LeaveType[] {
    return Array.from(this.leaveTypes.values());
  }

  public createLeaveType(data: Partial<LeaveType>, actor_id: string, actor_name: string): LeaveType {
    const id = `lt_${Date.now()}`;
    const lt: LeaveType = {
      id,
      name: data.name || 'New Leave',
      code: data.code || 'LV',
      days_allowed_per_year: Number(data.days_allowed_per_year || 10),
      is_paid: Boolean(data.is_paid ?? true),
      accrual_frequency: data.accrual_frequency || 'yearly',
      can_carry_forward: Boolean(data.can_carry_forward),
      max_carry_forward_days: data.max_carry_forward_days,
      color: data.color || '#3B82F6',
      active: true,
    };
    this.leaveTypes.set(lt.id, lt);
    db.logAudit(actor_id, actor_name, 'hr_leavetype_created', 'leave_type', lt.id, `Created leave policy: ${lt.name} (${lt.days_allowed_per_year} days/yr)`);
    return lt;
  }

  public updateLeaveType(id: string, data: Partial<LeaveType>, actor_id: string, actor_name: string): LeaveType {
    const lt = this.leaveTypes.get(id);
    if (!lt) throw new Error(`Leave type not found: ${id}`);
    Object.assign(lt, data);
    db.logAudit(actor_id, actor_name, 'hr_leavetype_updated', 'leave_type', id, `Updated leave policy: ${lt.name}`);
    return lt;
  }

  public getLeaveRequests(params?: { employee_id?: string; status?: string }): LeaveRequest[] {
    let list = Array.from(this.leaveRequests.values());
    if (params?.employee_id) {
      list = list.filter(r => r.employee_id === params.employee_id);
    }
    if (params?.status && params.status !== 'all') {
      list = list.filter(r => r.status === params.status);
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public applyLeave(params: {
    employee_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    reason: string;
    actor_id: string;
    actor_name: string;
  }): LeaveRequest {
    const emp = db.employees.get(params.employee_id);
    if (!emp) throw new Error(`Employee not found: ${params.employee_id}`);
    const lType = this.leaveTypes.get(params.leave_type_id);
    if (!lType) throw new Error(`Leave type not found: ${params.leave_type_id}`);

    const start = new Date(params.start_date);
    const end = new Date(params.end_date);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) throw new Error('End date cannot be earlier than start date.');
    const totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

    // Check balance if paid
    if (lType.is_paid && emp.leave_balances) {
      const currentBal = emp.leave_balances[lType.id] ?? 0;
      if (currentBal < totalDays) {
        throw new Error(`Insufficient leave balance. Available: ${currentBal} days, Requested: ${totalDays} days.`);
      }
    }

    const id = `LV-${Date.now()}`;
    const req: LeaveRequest = {
      id,
      employee_id: emp.id,
      employee_name: emp.name,
      leave_type_id: lType.id,
      leave_type_name: lType.name,
      start_date: params.start_date,
      end_date: params.end_date,
      total_days: totalDays,
      reason: params.reason,
      status: 'pending_manager',
      created_at: new Date().toISOString(),
    };

    this.leaveRequests.set(id, req);
    db.logAudit(
      params.actor_id,
      params.actor_name,
      'leave_applied',
      'leave_request',
      id,
      `${emp.name} applied for ${totalDays} days of ${lType.name} (${params.start_date} to ${params.end_date}): "${params.reason}"`
    );

    return req;
  }

  public reviewLeave(params: {
    id: string;
    action: 'manager_approve' | 'manager_reject' | 'hr_approve' | 'hr_reject' | 'cancel';
    notes?: string;
    actor_id: string;
    actor_name: string;
  }): LeaveRequest {
    const req = this.leaveRequests.get(params.id);
    if (!req) throw new Error(`Leave request not found: ${params.id}`);

    const emp = db.employees.get(req.employee_id);

    if (params.action === 'manager_approve') {
      req.status = 'pending_hr';
      req.manager_approval_by = params.actor_id;
      req.manager_approval_at = new Date().toISOString();
      req.manager_notes = params.notes;
    } else if (params.action === 'manager_reject') {
      req.status = 'rejected';
      req.manager_approval_by = params.actor_id;
      req.manager_approval_at = new Date().toISOString();
      req.manager_notes = params.notes;
    } else if (params.action === 'hr_approve') {
      req.status = 'approved';
      req.hr_approval_by = params.actor_id;
      req.hr_approval_at = new Date().toISOString();
      req.hr_notes = params.notes;

      // Deduct balance from employee
      if (emp && emp.leave_balances && emp.leave_balances[req.leave_type_id] !== undefined) {
        emp.leave_balances[req.leave_type_id] = Math.max(0, emp.leave_balances[req.leave_type_id] - req.total_days);
      }

      // Populate attendance records as 'on_leave'
      const start = new Date(req.start_date);
      for (let i = 0; i < req.total_days; i++) {
        const cur = new Date(start);
        cur.setDate(cur.getDate() + i);
        const dateStr = cur.toISOString().slice(0, 10);
        const attId = `ATT-${req.employee_id}-${dateStr}`;
        this.attendanceRecords.set(attId, {
          id: attId,
          employee_id: req.employee_id,
          employee_name: req.employee_name,
          date: dateStr,
          status: 'on_leave',
          is_manual: false,
          punch_in_method: 'web',
          notes: `Approved Leave: ${req.leave_type_name}`,
          created_by: params.actor_name,
          created_at: new Date().toISOString(),
        });
      }
    } else if (params.action === 'hr_reject') {
      req.status = 'rejected';
      req.hr_approval_by = params.actor_id;
      req.hr_approval_at = new Date().toISOString();
      req.hr_notes = params.notes;
    } else if (params.action === 'cancel') {
      req.status = 'cancelled';
    }

    db.logAudit(
      params.actor_id,
      params.actor_name,
      'leave_reviewed',
      'leave_request',
      req.id,
      `Leave request ${req.id} for ${req.employee_name} was marked ${req.status}. Action: ${params.action}. Notes: ${params.notes || 'None'}`
    );

    return req;
  }

  // Manual fallback for leave balances
  public adjustLeaveBalance(params: {
    employee_id: string;
    leave_type_id: string;
    adjustment_days: number;
    reason: string;
    actor_id: string;
    actor_name: string;
  }): LeaveAdjustment {
    if (!params.reason || params.reason.trim().length < 5) {
      throw new Error('Mandatory audit reason (minimum 5 characters) required for manual leave balance adjustments.');
    }

    const emp = db.employees.get(params.employee_id);
    if (!emp) throw new Error(`Employee not found: ${params.employee_id}`);
    const lType = this.leaveTypes.get(params.leave_type_id);
    if (!lType) throw new Error(`Leave type not found: ${params.leave_type_id}`);

    if (!emp.leave_balances) emp.leave_balances = {};
    const oldBal = emp.leave_balances[lType.id] ?? lType.days_allowed_per_year;
    const newBal = oldBal + params.adjustment_days;
    emp.leave_balances[lType.id] = newBal;

    const id = `LADJ-${Date.now()}`;
    const adj: LeaveAdjustment = {
      id,
      employee_id: emp.id,
      employee_name: emp.name,
      leave_type_id: lType.id,
      leave_type_name: lType.name,
      adjustment_days: params.adjustment_days,
      reason: params.reason,
      adjusted_by: params.actor_id,
      adjusted_by_name: params.actor_name,
      created_at: new Date().toISOString(),
    };

    this.leaveAdjustments.set(id, adj);
    db.logAudit(
      params.actor_id,
      params.actor_name,
      'leave_balance_adjusted',
      'leave_balance',
      id,
      `Adjusted ${lType.name} balance for ${emp.name} by ${params.adjustment_days > 0 ? '+' : ''}${params.adjustment_days} days (${oldBal} → ${newBal}). Reason: "${params.reason}"`
    );

    return adj;
  }

  // ============================================================================
  // SALARY ADVANCE & LOAN INTEGRATION (REAL ACCOUNTING TRANSACTIONS)
  // ============================================================================
  public getSalaryAdvances(employee_id?: string): SalaryAdvance[] {
    let list = Array.from(this.salaryAdvances.values());
    if (employee_id) {
      list = list.filter(a => a.employee_id === employee_id);
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public requestSalaryAdvance(params: {
    employee_id: string;
    amount: number;
    monthly_installment: number;
    repayment_months: number;
    reason: string;
    actor_id: string;
    actor_name: string;
  }): SalaryAdvance {
    const emp = db.employees.get(params.employee_id);
    if (!emp) throw new Error(`Employee not found: ${params.employee_id}`);

    const id = `ADV-${Date.now()}`;
    const advNumber = `ADV-${new Date().getFullYear()}-${String(this.salaryAdvances.size + 1).padStart(3, '0')}`;

    const adv: SalaryAdvance = {
      id,
      advance_number: advNumber,
      employee_id: emp.id,
      employee_name: emp.name,
      amount: Number(params.amount),
      disbursed_amount: 0,
      remaining_balance: Number(params.amount),
      monthly_installment: Number(params.monthly_installment),
      repayment_months: Number(params.repayment_months),
      deducted_so_far: 0,
      reason: params.reason,
      status: 'requested',
      created_by: params.actor_id,
      created_at: new Date().toISOString(),
    };

    this.salaryAdvances.set(id, adv);
    db.logAudit(
      params.actor_id,
      params.actor_name,
      'salary_advance_requested',
      'salary_advance',
      id,
      `Salary advance of ৳${adv.amount.toLocaleString()} requested for ${emp.name}. Reason: "${adv.reason}"`
    );

    return adv;
  }

  // Real Accounting Integration: Dr acc_salary_advance (1150), Cr paymentAccount
  public disburseSalaryAdvance(params: {
    advance_id: string;
    payment_account_id: string;
    payment_date?: string;
    actor_id: string;
    actor_name: string;
  }): SalaryAdvance {
    const adv = this.salaryAdvances.get(params.advance_id);
    if (!adv) throw new Error(`Salary advance not found: ${params.advance_id}`);
    if (adv.status === 'disbursed') throw new Error('Salary advance has already been disbursed.');

    const emp = db.employees.get(adv.employee_id);
    if (!emp) throw new Error(`Employee not found: ${adv.employee_id}`);

    const paymentAcc = db.accounts.get(params.payment_account_id);
    if (!paymentAcc) throw new Error(`Payment account not found: ${params.payment_account_id}`);

    const advanceAssetAcc = db.accounts.get('acc_salary_advance');
    if (!advanceAssetAcc) throw new Error('Salary Advance Asset account (acc_salary_advance) not found in Chart of Accounts.');

    const paymentDate = params.payment_date || new Date().toISOString().slice(0, 10);

    // POST REAL ACCOUNTING TRANSACTION:
    // Dr. Salary Advances & Employee Loans (Asset 1150)
    // Cr. Payment Account (Bank / Cash / MFS)
    const journalEntry = db.postJournal(
      paymentDate,
      'payroll',
      adv.id,
      `Salary Advance Disbursement: ${adv.advance_number} to ${emp.name}`,
      [
        { account_id: advanceAssetAcc.id, debit: adv.amount, credit: 0, line_desc: `Advance granted to ${emp.name} (${adv.advance_number})` },
        { account_id: paymentAcc.id, debit: 0, credit: adv.amount, line_desc: `Advance disbursement from ${paymentAcc.name}` },
      ],
      params.actor_name
    );

    adv.status = 'disbursed';
    adv.disbursed_amount = adv.amount;
    adv.disbursement_account_id = paymentAcc.id;
    adv.disbursement_account_name = paymentAcc.name;
    adv.disbursement_date = paymentDate;
    adv.journal_entry_id = journalEntry.id;

    // Update employee's active loan balance
    emp.active_loan_balance = (emp.active_loan_balance || 0) + adv.amount;

    db.logAudit(
      params.actor_id,
      params.actor_name,
      'salary_advance_disbursed',
      'salary_advance',
      adv.id,
      `Disbursed Salary Advance ${adv.advance_number} of ৳${adv.amount.toLocaleString()} to ${emp.name} via ${paymentAcc.name}. Journal Ref: ${journalEntry.id}`
    );

    return adv;
  }

  // ============================================================================
  // AUTOMATED MONTHLY PAYROLL WITH ATTENDANCE INTEGRATION & MANUAL FALLBACK
  // ============================================================================
  public calculateMonthlyPayroll(payroll_month: string): PayrollPeriodRun {
    const employees = Array.from(db.employees.values()).filter(e => e.employment_status === 'active' || e.active);
    const [yearStr, monthStr] = payroll_month.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    const daysInMonth = new Date(year, month, 0).getDate();
    const workingDaysExpected = 26; // Standard 26 working days in retail reselling

    const slips: PayrollRecord[] = [];
    let totalGross = 0;
    let totalAllowances = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    employees.forEach(emp => {
      const baseSalary = emp.base_salary;
      const struct = emp.salary_structure || {
        basic: Math.round(baseSalary * 0.6),
        house_rent: Math.round(baseSalary * 0.25),
        medical: Math.round(baseSalary * 0.1),
        conveyance: Math.round(baseSalary * 0.05),
        other_allowance: 0,
        tax_deduction: 0,
        provident_fund: 0,
        other_deductions: 0,
      };

      // Count attendance in this payroll month
      const empAttendance = Array.from(this.attendanceRecords.values()).filter(
        a => a.employee_id === emp.id && a.date.startsWith(payroll_month)
      );

      const presentCount = empAttendance.filter(a => a.status === 'present').length;
      const lateCount = empAttendance.filter(a => a.status === 'late').length;
      const halfDayCount = empAttendance.filter(a => a.status === 'half_day').length;
      const onLeaveCount = empAttendance.filter(a => a.status === 'on_leave').length;

      // 3 late marks = 1 day absence (standard policy, owner-configurable)
      const lateAbsences = Math.floor(lateCount / 3);
      const halfDayAbsences = halfDayCount * 0.5;

      // Unexcused absence deduction
      const totalAttendedEffective = presentCount + onLeaveCount + (lateCount - lateAbsences) + (halfDayCount - halfDayAbsences);
      const absentDays = Math.max(0, workingDaysExpected - totalAttendedEffective);
      const absenceDeduction = absentDays > 0 ? Math.round((baseSalary / workingDaysExpected) * absentDays) : 0;

      // Check for active salary advance installment
      const activeAdvance = Array.from(this.salaryAdvances.values()).find(
        a => a.employee_id === emp.id && a.status === 'disbursed' && a.remaining_balance > 0
      );
      const advanceDeduction = activeAdvance ? Math.min(activeAdvance.monthly_installment, activeAdvance.remaining_balance) : 0;

      const allowancesSum = struct.house_rent + struct.medical + struct.conveyance + struct.other_allowance;
      const grossSalary = struct.basic + allowancesSum;

      const deductionsSum = struct.tax_deduction + struct.provident_fund + struct.other_deductions + absenceDeduction + advanceDeduction;
      const netPayable = Math.max(0, grossSalary - deductionsSum);

      const payslipNum = `PAY-${payroll_month}-${emp.employee_id_code || emp.id}`;

      const slip: PayrollRecord = {
        id: `PR-${payroll_month}-${emp.id}`,
        payslip_number: payslipNum,
        payroll_month,
        employee_id: emp.id,
        employee_name: emp.name,
        designation: emp.designation,
        department_name: emp.department_name,
        base_salary: struct.basic,
        house_rent: struct.house_rent,
        medical_allowance: struct.medical,
        conveyance: struct.conveyance,
        other_allowances: struct.other_allowance,
        gross_salary: grossSalary,
        bonus_commission: 0,
        deductions: deductionsSum,
        tax_deduction: struct.tax_deduction,
        pf_deduction: struct.provident_fund,
        advance_deduction: advanceDeduction,
        absence_deduction: absenceDeduction,
        net_payable: netPayable,
        payment_account_id: emp.disbursement_method === 'bank' ? 'acc_bank' : emp.disbursement_method === 'bkash' ? 'acc_bkash' : 'acc_cash',
        payment_account_name: emp.disbursement_method === 'bank' ? 'City Bank Checking' : emp.disbursement_method === 'bkash' ? 'bKash Merchant Wallet' : 'Cash in Hand',
        payment_date: new Date().toISOString().slice(0, 10),
        status: 'pending',
        working_days: workingDaysExpected,
        present_days: presentCount + lateCount,
        paid_leave_days: onLeaveCount,
        unpaid_leave_days: absentDays,
        created_by: 'system',
        created_at: new Date().toISOString(),
      };

      slips.push(slip);
      totalGross += grossSalary;
      totalAllowances += allowancesSum;
      totalDeductions += deductionsSum;
      totalNet += netPayable;
    });

    const runId = `RUN-${payroll_month}`;
    const run: PayrollPeriodRun = {
      id: runId,
      payroll_month,
      total_employees: employees.length,
      total_gross_salary: totalGross,
      total_allowances: totalAllowances,
      total_deductions: totalDeductions,
      total_net_payable: totalNet,
      status: 'draft',
      slips,
      created_by: 'system',
      created_at: new Date().toISOString(),
    };

    this.payrollRuns.set(runId, run);
    return run;
  }

  // Manual fallback path: Override specific payroll line item before finalization
  public manualOverridePayrollLine(params: {
    payroll_month: string;
    employee_id: string;
    bonus_commission: number;
    extra_deductions: number;
    override_reason: string;
    actor_id: string;
    actor_name: string;
  }): PayrollRecord {
    if (!params.override_reason || params.override_reason.trim().length < 5) {
      throw new Error('Mandatory justification reason required for manual payroll line adjustments.');
    }

    const runId = `RUN-${params.payroll_month}`;
    let run = this.payrollRuns.get(runId);
    if (!run) {
      run = this.calculateMonthlyPayroll(params.payroll_month);
    }

    const slip = run.slips.find(s => s.employee_id === params.employee_id);
    if (!slip) throw new Error(`Slip not found for employee ${params.employee_id} in month ${params.payroll_month}`);

    slip.bonus_commission = Number(params.bonus_commission || 0);
    const baseDeductions = (slip.tax_deduction || 0) + (slip.pf_deduction || 0) + (slip.advance_deduction || 0) + (slip.absence_deduction || 0);
    slip.deductions = baseDeductions + Number(params.extra_deductions || 0);

    const gross = (slip.gross_salary || slip.base_salary) + slip.bonus_commission;
    slip.net_payable = Math.max(0, gross - slip.deductions);
    slip.is_manual_override = true;
    slip.override_reason = params.override_reason;
    slip.override_by = params.actor_name;

    // Recalculate run totals
    run.total_gross_salary = run.slips.reduce((acc, s) => acc + (s.gross_salary || s.base_salary) + s.bonus_commission, 0);
    run.total_deductions = run.slips.reduce((acc, s) => acc + s.deductions, 0);
    run.total_net_payable = run.slips.reduce((acc, s) => acc + s.net_payable, 0);

    db.logAudit(
      params.actor_id,
      params.actor_name,
      'payroll_manual_override',
      'payroll',
      slip.id,
      `Manual adjustment on ${slip.employee_name}'s ${params.payroll_month} slip: Bonus +৳${slip.bonus_commission}, Extra Deductions ৳${params.extra_deductions}, Net ৳${slip.net_payable.toLocaleString()}. Reason: "${params.override_reason}"`
    );

    return slip;
  }

  // Real Accounting Finalization: Dr acc_salary_exp, Cr paymentAccount, Cr acc_salary_advance, Cr acc_pf_payable
  public finalizePayrollRun(params: {
    payroll_month: string;
    payment_account_id: string;
    actor_id: string;
    actor_name: string;
    notes?: string;
  }): PayrollPeriodRun {
    const runId = `RUN-${params.payroll_month}`;
    let run = this.payrollRuns.get(runId);
    if (!run) {
      run = this.calculateMonthlyPayroll(params.payroll_month);
    }

    if (run.status === 'finalized') {
      throw new Error(`Payroll for ${params.payroll_month} has already been finalized and posted to Accounting.`);
    }

    const paymentAcc = db.accounts.get(params.payment_account_id);
    if (!paymentAcc) throw new Error(`Disbursement account not found: ${params.payment_account_id}`);

    const salaryExpAcc = db.accounts.get('acc_salary_exp');
    if (!salaryExpAcc) throw new Error('Salary Expense account (acc_salary_exp) not found.');

    const advanceAssetAcc = db.accounts.get('acc_salary_advance');
    const pfPayableAcc = db.accounts.get('acc_pf_payable');
    const taxPayableAcc = db.accounts.get('acc_tax_payable');

    const paymentDate = new Date().toISOString().slice(0, 10);

    let totalGrossExpense = 0;
    let totalNetPayableDisbursed = 0;
    let totalAdvanceRecovered = 0;
    let totalPFCollected = 0;
    let totalTaxCollected = 0;

    // Process each slip
    run.slips.forEach(slip => {
      const gross = (slip.gross_salary || slip.base_salary) + slip.bonus_commission;
      totalGrossExpense += gross;
      totalNetPayableDisbursed += slip.net_payable;

      const advDed = slip.advance_deduction || 0;
      totalAdvanceRecovered += advDed;

      const pfDed = slip.pf_deduction || 0;
      totalPFCollected += pfDed;

      const taxDed = slip.tax_deduction || 0;
      totalTaxCollected += taxDed;

      // Recover advance installments
      if (advDed > 0) {
        const activeAdv = Array.from(this.salaryAdvances.values()).find(
          a => a.employee_id === slip.employee_id && a.status === 'disbursed' && a.remaining_balance > 0
        );
        if (activeAdv) {
          activeAdv.deducted_so_far += advDed;
          activeAdv.remaining_balance = Math.max(0, activeAdv.remaining_balance - advDed);
          if (activeAdv.remaining_balance === 0) {
            activeAdv.status = 'closed';
          }
          const emp = db.employees.get(slip.employee_id);
          if (emp) {
            emp.active_loan_balance = Math.max(0, (emp.active_loan_balance || 0) - advDed);
          }
        }
      }

      slip.status = 'paid';
      slip.payment_account_id = paymentAcc.id;
      slip.payment_account_name = paymentAcc.name;
      slip.payment_date = paymentDate;

      // Save to canonical db.payrollRecords
      db.payrollRecords.set(slip.id, slip);
    });

    // Construct Balanced Double-Entry Journal Lines:
    // Debit: Employee Salaries Expense (Gross)
    // Credit: Payment Account (Net Cash/Bank outflow)
    // Credit: Salary Advances Receivable (Asset reduction for loan recovery)
    // Credit: Provident Fund Payable (Liability)
    // Credit: Payroll Tax Payable (Liability)
    const journalLines: { account_id: string; debit: number; credit: number; line_desc: string }[] = [
      { account_id: salaryExpAcc.id, debit: totalGrossExpense, credit: 0, line_desc: `Gross Salaries & Allowances (${params.payroll_month})` },
      { account_id: paymentAcc.id, debit: 0, credit: totalNetPayableDisbursed, line_desc: `Net Salary Disbursement via ${paymentAcc.name}` },
    ];

    if (totalAdvanceRecovered > 0 && advanceAssetAcc) {
      journalLines.push({
        account_id: advanceAssetAcc.id,
        debit: 0,
        credit: totalAdvanceRecovered,
        line_desc: `Salary Advance Recoveries deducted from ${params.payroll_month} payroll`,
      });
    }

    if (totalPFCollected > 0 && pfPayableAcc) {
      journalLines.push({
        account_id: pfPayableAcc.id,
        debit: 0,
        credit: totalPFCollected,
        line_desc: `Employee Provident Fund deductions (${params.payroll_month})`,
      });
    }

    if (totalTaxCollected > 0 && taxPayableAcc) {
      journalLines.push({
        account_id: taxPayableAcc.id,
        debit: 0,
        credit: totalTaxCollected,
        line_desc: `Income Tax withholding deducted from ${params.payroll_month} payroll`,
      });
    }

    // POST REAL ACCOUNTING TRANSACTION
    const journalEntry = db.postJournal(
      paymentDate,
      'payroll',
      run.id,
      `Monthly Payroll Disbursement: ${params.payroll_month} (${run.slips.length} employees)`,
      journalLines,
      params.actor_name
    );

    run.status = 'finalized';
    run.journal_entry_id = journalEntry.id;
    run.payment_account_id = paymentAcc.id;
    run.payment_account_name = paymentAcc.name;
    run.finalized_at = new Date().toISOString();

    db.logAudit(
      params.actor_id,
      params.actor_name,
      'payroll_finalized',
      'payroll',
      run.id,
      `Finalized ${params.payroll_month} Payroll: Gross ৳${totalGrossExpense.toLocaleString()}, Net Disbursed ৳${totalNetPayableDisbursed.toLocaleString()} via ${paymentAcc.name}. Journal Ref: ${journalEntry.id}`
    );

    return run;
  }

  // ============================================================================
  // RECRUITMENT PIPELINE API
  // ============================================================================
  public getJobRequisitions(): JobRequisition[] {
    return Array.from(this.jobRequisitions.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public createJobRequisition(data: Partial<JobRequisition>, actor_id: string, actor_name: string): JobRequisition {
    const id = `JOB-${new Date().getFullYear()}-${String(this.jobRequisitions.size + 1).padStart(3, '0')}`;
    const job: JobRequisition = {
      id,
      title: data.title || 'New Opening',
      department_id: data.department_id || 'dept_sales',
      department_name: data.department_name || 'Showroom & Retail Sales',
      openings: Number(data.openings || 1),
      employment_type: data.employment_type || 'Full-time',
      experience_required: data.experience_required,
      salary_range: data.salary_range,
      description: data.description,
      status: 'open',
      created_at: new Date().toISOString().slice(0, 10),
    };
    this.jobRequisitions.set(id, job);
    db.logAudit(actor_id, actor_name, 'hr_job_created', 'job_requisition', id, `Opened job requisition: ${job.title} (${job.openings} vacancies)`);
    return job;
  }

  public updateJobRequisition(id: string, data: Partial<JobRequisition>, actor_id: string, actor_name: string): JobRequisition {
    const job = this.jobRequisitions.get(id);
    if (!job) throw new Error(`Job requisition not found: ${id}`);
    Object.assign(job, data);
    db.logAudit(actor_id, actor_name, 'hr_job_updated', 'job_requisition', id, `Updated job requisition: ${job.title}`);
    return job;
  }

  public getJobCandidates(requisition_id?: string): JobCandidate[] {
    let list = Array.from(this.jobCandidates.values());
    if (requisition_id) {
      list = list.filter(c => c.job_requisition_id === requisition_id);
    }
    return list.sort((a, b) => b.applied_at.localeCompare(a.applied_at));
  }

  public createJobCandidate(data: Partial<JobCandidate>, actor_id: string, actor_name: string): JobCandidate {
    const id = `CAND-${Date.now()}`;
    const cand: JobCandidate = {
      id,
      job_requisition_id: data.job_requisition_id || '',
      job_title: data.job_title || 'Fragrance Consultant',
      name: data.name || 'Candidate Name',
      email: data.email || '',
      phone: data.phone || '',
      current_stage: data.current_stage || 'applied',
      interview_date: data.interview_date,
      rating: data.rating,
      notes: data.notes,
      applied_at: new Date().toISOString().slice(0, 10),
    };
    this.jobCandidates.set(id, cand);
    db.logAudit(actor_id, actor_name, 'hr_candidate_added', 'candidate', id, `Added applicant ${cand.name} for ${cand.job_title}`);
    return cand;
  }

  public updateCandidateStage(id: string, stage: JobCandidate['current_stage'], notes?: string, actor_id?: string, actor_name?: string): JobCandidate {
    const cand = this.jobCandidates.get(id);
    if (!cand) throw new Error(`Candidate not found: ${id}`);
    const oldStage = cand.current_stage;
    cand.current_stage = stage;
    if (notes) cand.notes = notes;
    db.logAudit(actor_id || 'system', actor_name || 'HR Admin', 'hr_candidate_stage_updated', 'candidate', id, `Moved applicant ${cand.name} from ${oldStage} → ${stage}`);
    return cand;
  }

  // 1-Click Convert Candidate to Employee Master
  public hireCandidate(candidate_id: string, employee_data: Partial<Employee>, actor_id: string, actor_name: string): Employee {
    const cand = this.jobCandidates.get(candidate_id);
    if (!cand) throw new Error(`Candidate not found: ${candidate_id}`);

    const newEmp = this.createEmployee({
      name: cand.name,
      phone: cand.phone,
      email: cand.email,
      designation: employee_data.designation || cand.job_title,
      department_id: employee_data.department_id,
      department_name: employee_data.department_name,
      branch_id: employee_data.branch_id,
      branch_name: employee_data.branch_name,
      base_salary: employee_data.base_salary || 22000,
      joined_date: new Date().toISOString().slice(0, 10),
      ...employee_data,
    }, actor_id, actor_name);

    cand.current_stage = 'hired';
    cand.hired_employee_id = newEmp.id;

    db.logAudit(actor_id, actor_name, 'hr_candidate_hired', 'candidate', cand.id, `Candidate ${cand.name} hired and enrolled into Employee Master as ${newEmp.employee_id_code}`);
    return newEmp;
  }

  // ============================================================================
  // PERFORMANCE MANAGEMENT API
  // ============================================================================
  public getGoals(employee_id?: string): EmployeeGoal[] {
    let list = Array.from(this.employeeGoals.values());
    if (employee_id) list = list.filter(g => g.employee_id === employee_id);
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public createGoal(data: Partial<EmployeeGoal>, actor_id: string, actor_name: string): EmployeeGoal {
    const emp = db.employees.get(data.employee_id || '');
    const id = `GOAL-${Date.now()}`;
    const goal: EmployeeGoal = {
      id,
      employee_id: data.employee_id || '',
      employee_name: emp?.name || data.employee_name || 'Staff Member',
      title: data.title || 'Goal',
      description: data.description,
      target_date: data.target_date || new Date().toISOString().slice(0, 10),
      status: data.status || 'not_started',
      progress_percentage: Number(data.progress_percentage || 0),
      created_at: new Date().toISOString().slice(0, 10),
    };
    this.employeeGoals.set(id, goal);
    db.logAudit(actor_id, actor_name, 'hr_goal_created', 'goal', id, `Set performance goal for ${goal.employee_name}: ${goal.title}`);
    return goal;
  }

  public updateGoal(id: string, data: Partial<EmployeeGoal>, actor_id: string, actor_name: string): EmployeeGoal {
    const goal = this.employeeGoals.get(id);
    if (!goal) throw new Error(`Goal not found: ${id}`);
    Object.assign(goal, data);
    db.logAudit(actor_id, actor_name, 'hr_goal_updated', 'goal', id, `Updated goal progress for ${goal.employee_name}: ${goal.progress_percentage}%`);
    return goal;
  }

  public getPerformanceReviews(employee_id?: string): PerformanceReview[] {
    let list = Array.from(this.performanceReviews.values());
    if (employee_id) list = list.filter(r => r.employee_id === employee_id);
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public createPerformanceReview(data: Partial<PerformanceReview>, actor_id: string, actor_name: string): PerformanceReview {
    const emp = db.employees.get(data.employee_id || '');
    const id = `REV-${Date.now()}`;
    const rev: PerformanceReview = {
      id,
      employee_id: data.employee_id || '',
      employee_name: emp?.name || data.employee_name || 'Staff Member',
      cycle: data.cycle || '2026-Q1',
      reviewer_id: actor_id,
      reviewer_name: actor_name,
      rating: Number(data.rating || 3),
      strengths: data.strengths || '',
      areas_for_improvement: data.areas_for_improvement || '',
      feedback: data.feedback || '',
      status: 'submitted',
      created_at: new Date().toISOString().slice(0, 10),
    };
    this.performanceReviews.set(id, rev);
    db.logAudit(actor_id, actor_name, 'hr_review_submitted', 'review', id, `Submitted ${rev.cycle} appraisal review for ${rev.employee_name}: Rating ${rev.rating}/5`);
    return rev;
  }

  // ============================================================================
  // OFFBOARDING & FULL-AND-FINAL SETTLEMENT (REAL ACCOUNTING INTEGRATION)
  // ============================================================================
  public getExits(): EmployeeExitRecord[] {
    return Array.from(this.employeeExits.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public initiateExit(params: {
    employee_id: string;
    exit_type: EmployeeExitRecord['exit_type'];
    notice_date: string;
    last_working_date: string;
    reason: string;
    actor_id: string;
    actor_name: string;
  }): EmployeeExitRecord {
    const emp = db.employees.get(params.employee_id);
    if (!emp) throw new Error(`Employee not found: ${params.employee_id}`);

    const id = `EXIT-${Date.now()}`;
    const exitRecord: EmployeeExitRecord = {
      id,
      employee_id: emp.id,
      employee_name: emp.name,
      exit_type: params.exit_type,
      notice_date: params.notice_date,
      last_working_date: params.last_working_date,
      reason: params.reason,
      status: 'clearance_in_progress',
      clearance_items: [
        { item: 'Showroom Fragrance Tester inventory physical handover', cleared: false },
        { item: 'Cash till balance & sales receipt handover to Manager', cleared: false },
        { item: 'Staff ID badge, keys & warehouse access cards returned', cleared: false },
        { item: 'Mirage email & ERP account deactivation', cleared: false },
        { item: 'Finance clearance: Loan advance balance reconciled', cleared: false },
      ],
      settlement: {
        unpaid_salary: 0,
        leave_encashment_days: 0,
        leave_encashment_amount: 0,
        loan_deductions: emp.active_loan_balance || 0,
        other_adjustments: 0,
        net_settlement_amount: 0,
      },
      created_by: params.actor_id,
      created_at: new Date().toISOString(),
    };

    this.employeeExits.set(id, exitRecord);
    db.logAudit(
      params.actor_id,
      params.actor_name,
      'hr_exit_initiated',
      'employee_exit',
      id,
      `Initiated ${params.exit_type} for ${emp.name}. Last working day: ${params.last_working_date}`
    );

    return exitRecord;
  }

  public updateExitClearance(params: {
    exit_id: string;
    item_index: number;
    cleared: boolean;
    notes?: string;
    actor_id: string;
    actor_name: string;
  }): EmployeeExitRecord {
    const exit = this.employeeExits.get(params.exit_id);
    if (!exit) throw new Error(`Exit record not found: ${params.exit_id}`);
    if (!exit.clearance_items[params.item_index]) throw new Error('Invalid clearance item index.');

    exit.clearance_items[params.item_index].cleared = params.cleared;
    exit.clearance_items[params.item_index].notes = params.notes;
    exit.clearance_items[params.item_index].cleared_by = params.actor_name;

    db.logAudit(
      params.actor_id,
      params.actor_name,
      'hr_exit_clearance_updated',
      'employee_exit',
      exit.id,
      `Clearance item "${exit.clearance_items[params.item_index].item}" marked ${params.cleared ? 'CLEARED' : 'PENDING'} for ${exit.employee_name}`
    );

    return exit;
  }

  // Real Accounting Settlement: Dr acc_salary_exp, Cr paymentAccount, Cr acc_salary_advance
  public settleExit(params: {
    exit_id: string;
    unpaid_salary: number;
    leave_encashment_days: number;
    leave_encashment_amount: number;
    loan_deductions: number;
    other_adjustments: number;
    payment_account_id: string;
    actor_id: string;
    actor_name: string;
  }): EmployeeExitRecord {
    const exit = this.employeeExits.get(params.exit_id);
    if (!exit) throw new Error(`Exit record not found: ${params.exit_id}`);
    if (exit.status === 'settled') throw new Error('Exit settlement has already been completed.');

    const emp = db.employees.get(exit.employee_id);
    if (!emp) throw new Error(`Employee not found: ${exit.employee_id}`);

    const paymentAcc = db.accounts.get(params.payment_account_id);
    if (!paymentAcc) throw new Error(`Disbursement account not found: ${params.payment_account_id}`);

    const salaryExpAcc = db.accounts.get('acc_salary_exp');
    const advanceAssetAcc = db.accounts.get('acc_salary_advance');

    const totalGrossCompensation = Number(params.unpaid_salary || 0) + Number(params.leave_encashment_amount || 0) + Number(params.other_adjustments || 0);
    const loanDeduction = Number(params.loan_deductions || 0);
    const netSettlement = Math.max(0, totalGrossCompensation - loanDeduction);

    const paymentDate = new Date().toISOString().slice(0, 10);

    const journalLines: { account_id: string; debit: number; credit: number; line_desc: string }[] = [
      { account_id: salaryExpAcc!.id, debit: totalGrossCompensation, credit: 0, line_desc: `Final Exit Settlement & Encashment for ${emp.name}` },
      { account_id: paymentAcc.id, debit: 0, credit: netSettlement, line_desc: `Final Settlement Disbursed from ${paymentAcc.name}` },
    ];

    if (loanDeduction > 0 && advanceAssetAcc) {
      journalLines.push({
        account_id: advanceAssetAcc.id,
        debit: 0,
        credit: loanDeduction,
        line_desc: `Final loan recovery offset from exit settlement for ${emp.name}`,
      });
    }

    // POST REAL ACCOUNTING TRANSACTION
    const journalEntry = db.postJournal(
      paymentDate,
      'payroll',
      exit.id,
      `Full & Final Settlement for ${emp.name} (${exit.exit_type})`,
      journalLines,
      params.actor_name
    );

    exit.status = 'settled';
    exit.settlement = {
      unpaid_salary: Number(params.unpaid_salary || 0),
      leave_encashment_days: Number(params.leave_encashment_days || 0),
      leave_encashment_amount: Number(params.leave_encashment_amount || 0),
      loan_deductions: loanDeduction,
      other_adjustments: Number(params.other_adjustments || 0),
      net_settlement_amount: netSettlement,
      payment_account_id: paymentAcc.id,
      payment_account_name: paymentAcc.name,
      journal_entry_id: journalEntry.id,
      settled_at: new Date().toISOString(),
    };

    // Update employee status (NEVER DELETE HISTORICAL RECORDS)
    emp.employment_status = exit.exit_type === 'resignation' ? 'resigned' : 'terminated';
    emp.active = false;
    emp.active_loan_balance = 0;

    db.logAudit(
      params.actor_id,
      params.actor_name,
      'hr_exit_settled',
      'employee_exit',
      exit.id,
      `Full & Final Settlement completed for ${emp.name}: Net ৳${netSettlement.toLocaleString()} paid via ${paymentAcc.name}. Status set to ${emp.employment_status}. Journal: ${journalEntry.id}`
    );

    return exit;
  }

  // ============================================================================
  // HR DASHBOARD SUMMARY & ANALYTICS
  // ============================================================================
  public getDashboardSummary(): HRDashboardSummary {
    const employees = Array.from(db.employees.values());
    const total_employees = employees.length;
    const active_employees = employees.filter(e => e.employment_status === 'active' || e.active).length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayAtt = Array.from(this.attendanceRecords.values()).filter(a => a.date === todayStr);

    const present_today = todayAtt.filter(a => a.status === 'present' || a.status === 'late').length;
    const on_leave_today = todayAtt.filter(a => a.status === 'on_leave').length;
    const attendance_rate_percent = active_employees > 0 ? Math.round((present_today / active_employees) * 100) : 0;

    const pending_leaves_count = Array.from(this.leaveRequests.values()).filter(r => r.status === 'pending_manager' || r.status === 'pending_hr').length;
    const pending_regularizations_count = Array.from(this.attendanceRegularizations.values()).filter(r => r.status === 'pending').length;
    const pending_advances_count = Array.from(this.salaryAdvances.values()).filter(a => a.status === 'requested').length;

    // Expiring documents (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().slice(0, 10);

    let expiring_documents_count = 0;
    employees.forEach(e => {
      e.documents?.forEach(d => {
        if (d.expiry_date && d.expiry_date >= todayStr && d.expiry_date <= thirtyDaysStr) {
          expiring_documents_count++;
        }
      });
      if (e.probation_end_date && e.probation_end_date >= todayStr && e.probation_end_date <= thirtyDaysStr) {
        expiring_documents_count++;
      }
      if (e.contract_end_date && e.contract_end_date >= todayStr && e.contract_end_date <= thirtyDaysStr) {
        expiring_documents_count++;
      }
    });

    // Upcoming birthdays (current month)
    const curMonth = todayStr.slice(5, 7);
    const upcoming_birthdays_count = employees.filter(e => e.dob && e.dob.slice(5, 7) === curMonth).length;

    const monthly_payroll_estimate = employees
      .filter(e => e.employment_status === 'active' || e.active)
      .reduce((sum, e) => sum + e.base_salary, 0);

    return {
      total_employees,
      active_employees,
      on_leave_today,
      present_today,
      attendance_rate_percent,
      pending_leaves_count,
      pending_regularizations_count,
      pending_advances_count,
      expiring_documents_count,
      upcoming_birthdays_count,
      monthly_payroll_estimate,
    };
  }

  public getDashboardStats(): HRDashboardSummary {
    return this.getDashboardSummary();
  }

  public getSettings() {
    return this.hrSettings;
  }

  public updateSettings(updates: Partial<typeof this.hrSettings>, actor_id: string, actor_name: string) {
    this.hrSettings = { ...this.hrSettings, ...updates };
    db.logAudit(
      actor_id,
      actor_name,
      'UPDATE_HR_SETTINGS',
      'HR_SETTINGS',
      'global',
      updates
    );
    return this.hrSettings;
  }
}

export const hrService = new HRService();
