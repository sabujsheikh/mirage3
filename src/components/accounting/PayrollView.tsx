import { PageHeader } from '../common/PageHeader';
import React, { useState } from 'react';
import {
  Users,
  DollarSign,
  Plus,
  Search,
  FileText,
  CheckCircle2,
  Calendar,
  Building,
  UserPlus,
  RefreshCw,
  Printer,
  Download,
  Eye,
  X,
  CreditCard,
  Phone,
  Mail,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Employee, PayrollRecord } from '../../types';

export const PayrollView: React.FC = () => {
  const {
    employees,
    payrollRecords,
    accounts,
    createEmployee,
    updateEmployee,
    processPayroll,
    refreshAll,
  } = useApp();
  const { can } = useAuth();

  const [activeTab, setActiveTab] = useState<'payroll' | 'employees'>('payroll');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('2026-02');

  // New Employee Modal
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empDesignation, setEmpDesignation] = useState('');
  const [empRole, setEmpRole] = useState('Showroom & Sales');
  const [empBaseSalary, setEmpBaseSalary] = useState<number>(25000);
  const [empMethod, setEmpMethod] = useState<'bank' | 'bkash' | 'cash'>('bank');
  const [empBankDetails, setEmpBankDetails] = useState('');
  const [empBkashNumber, setEmpBkashNumber] = useState('');

  // Disburse Payroll Modal
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [bonusCommission, setBonusCommission] = useState<number>(0);
  const [deductions, setDeductions] = useState<number>(0);
  const [paymentAccountId, setPaymentAccountId] = useState('acc_bank');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [txRef, setTxRef] = useState('');
  const [payrollNotes, setPayrollNotes] = useState('');

  // Printable Payslip Modal
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safePayrollRecords = Array.isArray(payrollRecords) ? payrollRecords : [];
  const safeAccounts = Array.isArray(accounts) ? accounts : [];

  const filteredEmployees = safeEmployees.filter((e) =>
    (e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.designation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.phone || '').includes(searchTerm)
  );

  const filteredPayroll = safePayrollRecords.filter((p) =>
    (p.employee_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.payslip_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.payroll_month || '').includes(searchTerm)
  );

  const totalMonthlyBasePayroll = safeEmployees.filter((e) => e.active).reduce((s, e) => s + (e.base_salary || 0), 0);
  const totalPaidYtd = safePayrollRecords.reduce((s, p) => s + (p.net_payable || 0), 0);

  const handleOpenDisburse = (emp: Employee) => {
    setSelectedEmployee(emp);
    setBonusCommission(0);
    setDeductions(0);
    setPaymentAccountId(emp.disbursement_method === 'bank' ? 'acc_bank' : emp.disbursement_method === 'bkash' ? 'acc_bkash' : 'acc_cash');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setTxRef('');
    setPayrollNotes('');
    setShowDisburseModal(true);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !empPhone.trim() || empBaseSalary <= 0) {
      setErrorMsg('Please fill in employee name, phone, and valid base salary.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await createEmployee({
        name: empName,
        phone: empPhone,
        email: empEmail,
        designation: empDesignation,
        role: empRole,
        base_salary: Number(empBaseSalary),
        disbursement_method: empMethod,
        bank_account_no: empBankDetails,
        bkash_number: empBkashNumber,
        joined_date: new Date().toISOString().slice(0, 10),
      });

      setShowAddEmpModal(false);
      setEmpName('');
      setEmpPhone('');
      setEmpEmail('');
      setEmpDesignation('');
      setEmpBaseSalary(25000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const rec = await processPayroll({
        payroll_month: selectedMonth,
        employee_id: selectedEmployee.id,
        bonus_commission: Number(bonusCommission),
        deductions: Number(deductions),
        payment_account_id: paymentAccountId,
        payment_date: paymentDate,
        transaction_reference: txRef,
        notes: payrollNotes,
      });

      setShowDisburseModal(false);
      setSelectedPayslip(rec);
      setShowPayslipModal(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process salary payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" id="payroll-view">
      {/* Top Header */}
      <PageHeader
        eyebrow="Accounting"
        title="Salary & Payslips"
        desc="Employee roster, monthly salary disbursement journals, and printable staff payslips"
        actions={
          can('manage_accounts') ? (
            <button
              onClick={() => setShowAddEmpModal(true)}
              className="erp-btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staff Member</span>
            </button>
          ) : undefined
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Monthly Active Headcount</span>
            <Users className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text)]">
            {employees.filter((e) => e.active).length} staff
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Active staff on company payroll</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Monthly Base Salary Roll</span>
            <DollarSign className="w-4 h-4 text-[var(--status-teal)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-teal)]">&#2547;{totalMonthlyBasePayroll.toLocaleString()}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Recurring monthly commitment</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Total Salaries Paid (YTD)</span>
            <CheckCircle2 className="w-4 h-4 text-[var(--status-green)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-green)]">&#2547;{totalPaidYtd.toLocaleString()}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Dr Employee Salaries (6020)</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-medium">Total Payslips Issued</span>
            <FileText className="w-4 h-4 text-[var(--status-amber)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-amber)]">{payrollRecords.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Verified compensation slips</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2">
        <button
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'payroll'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <FileText className="w-4 h-4" />
          Monthly Payroll Run & Payslip Ledger ({payrollRecords.length})
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'employees'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Users className="w-4 h-4" />
          Employee Directory ({employees.length})
        </button>
      </div>

      {/* View Content based on Tab */}
      {activeTab === 'payroll' ? (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search payslip #, staff name, month..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-bold text-[var(--text-muted)]">Active Run:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              />
            </div>
          </div>

          {/* Payroll Records Table */}
          <div className="dense-table-container">
            <div className="overflow-x-auto">
              <table className="dense-table">
                <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Payslip #</th>
                    <th className="py-3 px-4">Month</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4 text-right">Base Salary</th>
                    <th className="py-3 px-4 text-right">Bonus / Comm</th>
                    <th className="py-3 px-4 text-right">Deductions</th>
                    <th className="py-3 px-4 text-right">Net Disbursed</th>
                    <th className="py-3 px-4">Paid Account</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredPayroll.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-[var(--text-muted)]">
                        No payroll records found. Select an employee from Directory to disburse monthly salary.
                      </td>
                    </tr>
                  ) : (
                    filteredPayroll.map((p) => (
                      <tr key={p.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="py-3 px-4 font-bold text-[var(--text)] font-mono">
                          {p.payslip_number}
                        </td>

                        <td className="py-3 px-4 font-mono font-semibold text-[var(--accent)]">
                          {p.payroll_month}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-[var(--text)]">{p.employee_name}</div>
                          <div className="text-[11px] text-[var(--text-muted)]">{p.designation}</div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-[var(--text-muted)]">
                          &#2547;{p.base_salary.toLocaleString()}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-[var(--status-green)] font-bold">
                          {p.bonus_commission > 0 ? `+\u09F3${p.bonus_commission.toLocaleString()}` : '\u2014'}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-[var(--status-red)]">
                          {p.deductions > 0 ? `-\u09F3${p.deductions.toLocaleString()}` : '\u2014'}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-black text-[var(--text)] text-sm">
                          &#2547;{p.net_payable.toLocaleString()}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-[var(--text)]">{p.payment_account_name}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">{p.payment_date}</div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedPayslip(p);
                              setShowPayslipModal(true);
                            }}
                            className="p-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--accent)] hover:text-white rounded transition-colors cursor-pointer"
                            title="View Printable Payslip"
                          >
                            <Printer className="w-3.5 h-3.5" />
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
        /* Employee Directory Tab */
        <div className="space-y-4">
          <div className="dense-table-container">
            <div className="overflow-x-auto">
              <table className="dense-table">
                <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Designation & Role</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4 text-right">Monthly Base Salary</th>
                    <th className="py-3 px-4">Disbursement Channel</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="py-3 px-4 font-bold text-[var(--text)]">
                        {emp.name}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-[var(--text)]">{emp.designation}</div>
                        <div className="text-[10px] text-[var(--accent)] uppercase font-bold">{emp.role}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                        <div>{emp.phone}</div>
                        {emp.email && <div className="text-[10px]">{emp.email}</div>}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[var(--text)] text-sm">
                        &#2547;{emp.base_salary.toLocaleString()}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold uppercase text-[10px] text-[var(--accent)]">
                          {emp.disbursement_method}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono">
                          {emp.bank_account_no || emp.bkash_number || 'Direct Cash Till'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenDisburse(emp)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 shadow-xs cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Disburse Salary
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Disburse Salary --- */}
      {showDisburseModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    Disburse Salary: {selectedEmployee.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Month: {selectedMonth} &#8226; Designation: {selectedEmployee.designation}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDisburseModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDisburse} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)]">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)]">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Base Salary</span>
                  <p className="text-sm font-black text-[var(--text)] font-mono">
                    &#2547;{selectedEmployee.base_salary.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Bonus / Comm</span>
                  <p className="text-sm font-black text-[var(--status-green)] font-mono">
                    +&#2547;{Number(bonusCommission).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Net Payable</span>
                  <p className="text-sm font-black text-[var(--accent)] font-mono">
                    &#2547;{(selectedEmployee.base_salary + Number(bonusCommission) - Number(deductions)).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Performance Bonus / Commission (&#2547;)</label>
                  <input
                    type="number"
                    min="0"
                    value={bonusCommission}
                    onChange={(e) => setBonusCommission(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--status-green)] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Salary Advances / Deductions (&#2547;)</label>
                  <input
                    type="number"
                    min="0"
                    value={deductions}
                    onChange={(e) => setDeductions(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--status-red)] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Disburse From Account *</label>
                  <select
                    value={paymentAccountId}
                    onChange={(e) => setPaymentAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  >
                    {accounts
                      .filter((a) => a.type === 'asset')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (&#2547;{a.balance.toLocaleString()})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Bank / bKash Transaction Ref</label>
                <input
                  type="text"
                  placeholder="e.g. TT-90218, bKash TrxID: 9X29A81"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono"
                />
              </div>

              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] text-[11px] space-y-1">
                <p className="font-bold text-[var(--text)]">Automatic Double-Entry Posting:</p>
                <p className="text-[var(--text-muted)]">
                  <strong>Dr Employee Salaries Expense (6020)</strong>: &#2547;{(selectedEmployee.base_salary + Number(bonusCommission) - Number(deductions)).toLocaleString()}
                </p>
                <p className="text-[var(--text-muted)]">
                  <strong>Cr {accounts.find((a) => a.id === paymentAccountId)?.name}</strong>: &#2547;{(selectedEmployee.base_salary + Number(bonusCommission) - Number(deductions)).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowDisburseModal(false)}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Disbursing...' : 'Disburse & Generate Payslip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Printable Payslip Viewer --- */}
      {showPayslipModal && selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    Official Payslip: {selectedPayslip.payslip_number}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Period: {selectedPayslip.payroll_month}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer"
                  title="Print Payslip"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button onClick={() => setShowPayslipModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Payslip Card */}
            <div className="p-8 space-y-6 bg-white text-slate-900 font-sans" id="printable-payslip">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-950">MIRAGE PERFUME BANGLADESH</h2>
                  <p className="text-[11px] text-slate-500">House 47, Road 27, Banani, Dhaka &#8226; +8801999033027</p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-900 text-white">
                    Salary Compensation Voucher
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-500">Payslip No:</p>
                  <p className="font-mono font-bold text-sm text-slate-950">{selectedPayslip.payslip_number}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Payment Date: {selectedPayslip.payment_date}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Employee Name</span>
                  <p className="font-bold text-sm text-slate-950">{selectedPayslip.employee_name}</p>
                  <p className="text-[11px] text-slate-600">{selectedPayslip.designation}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Payroll Month</span>
                  <p className="font-bold text-sm text-slate-950 font-mono">{selectedPayslip.payroll_month}</p>
                  <p className="text-[11px] text-slate-600">Disbursed via {selectedPayslip.payment_account_name}</p>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="dense-table">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Earnings / Allowances</th>
                      <th className="py-2.5 px-4 text-right">Amount (&#2547;)</th>
                      <th className="py-2.5 px-4">Deductions</th>
                      <th className="py-2.5 px-4 text-right">Amount (&#2547;)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2 px-4 font-medium">Basic Monthly Salary</td>
                      <td className="py-2 px-4 text-right font-mono font-bold">&#2547;{selectedPayslip.base_salary.toLocaleString()}</td>
                      <td className="py-2 px-4 font-medium">Salary Advance</td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-rose-600">
                        {selectedPayslip.deductions > 0 ? `\u09F3${selectedPayslip.deductions.toLocaleString()}` : '\u09F30'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 font-medium">Sales Commission & Bonus</td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-emerald-600">
                        {selectedPayslip.bonus_commission > 0 ? `+\u09F3${selectedPayslip.bonus_commission.toLocaleString()}` : '\u09F30'}
                      </td>
                      <td className="py-2 px-4 font-medium">Other Deductions</td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-rose-600">&#2547;0</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-bold">
                    <tr>
                      <td className="py-3 px-4 text-sm">Total Net Salary Paid</td>
                      <td colSpan={3} className="py-3 px-4 text-right text-base font-black font-mono">
                        &#2547;{selectedPayslip.net_payable.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures */}
              <div className="pt-8 flex justify-between items-end text-center">
                <div>
                  <div className="w-36 border-b border-slate-400 mb-1" />
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Employee Signature</p>
                </div>
                <div>
                  <div className="w-36 border-b border-slate-400 mb-1" />
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Authorized Signatory (Owner)</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-sunken)] flex items-center justify-end">
              <button
                onClick={() => setShowPayslipModal(false)}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
