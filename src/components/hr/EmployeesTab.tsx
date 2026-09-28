import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Filter,
  Phone,
  Mail,
  Building,
  CreditCard,
  FileText,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Upload,
  Calendar,
  DollarSign,
  Shield,
  X,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface EmployeesTabProps {
  employees: any[];
  departments: any[];
  designations: any[];
  branches: any[];
  shifts: any[];
  onCreateEmployee: (data: any) => Promise<void>;
  onUpdateEmployee: (id: string, data: any) => Promise<void>;
  onAddDocument: (id: string, doc: any) => Promise<void>;
  onRemoveDocument: (id: string, docId: string) => Promise<void>;
}

export const EmployeesTab: React.FC<EmployeesTabProps> = ({
  employees,
  departments,
  designations,
  branches,
  shifts,
  onCreateEmployee,
  onUpdateEmployee,
  onAddDocument,
  onRemoveDocument,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [viewingEmp, setViewingEmp] = useState<any | null>(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    designation: '',
    department: '',
    branch: '',
    shift: '',
    employment_type: 'full_time',
    status: 'active',
    joining_date: new Date().toISOString().slice(0, 10),
    base_salary: 25000,
    hourly_rate: 0,
    payment_method: 'bank',
    bank_account_no: '',
    bank_name: '',
    bkash_number: '',
    nid_number: '',
    father_name: '',
    mother_name: '',
    dob: '',
    gender: 'male',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
  });

  // Doc Upload inside Profile Modal
  const [newDocType, setNewDocType] = useState('NID');
  const [newDocName, setNewDocName] = useState('');
  const [newDocExpiry, setNewDocExpiry] = useState('');

  const openAddModal = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      designation: designations[0]?.title || 'Sales Executive',
      department: departments[0]?.name || 'Showroom Sales',
      branch: branches[0]?.name || 'Banani Main Flagship',
      shift: shifts[0]?.name || 'General Morning Shift',
      employment_type: 'full_time',
      status: 'active',
      joining_date: new Date().toISOString().slice(0, 10),
      base_salary: 25000,
      hourly_rate: 0,
      payment_method: 'bank',
      bank_account_no: '',
      bank_name: '',
      bkash_number: '',
      nid_number: '',
      father_name: '',
      mother_name: '',
      dob: '',
      gender: 'male',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relation: '',
    });
    setEditingEmp(null);
    setShowAddModal(true);
  };

  const openEditModal = (emp: any) => {
    setEditingEmp(emp);
    setFormData({
      name: emp.name || '',
      phone: emp.phone || '',
      email: emp.email || '',
      designation: emp.designation || '',
      department: emp.department || '',
      branch: emp.branch || '',
      shift: emp.shift || '',
      employment_type: emp.employment_type || 'full_time',
      status: emp.status || 'active',
      joining_date: emp.joining_date || '',
      base_salary: emp.base_salary || 0,
      hourly_rate: emp.hourly_rate || 0,
      payment_method: emp.payment_method || 'bank',
      bank_account_no: emp.bank_account_no || '',
      bank_name: emp.bank_name || '',
      bkash_number: emp.bkash_number || '',
      nid_number: emp.nid_number || '',
      father_name: emp.father_name || '',
      mother_name: emp.mother_name || '',
      dob: emp.dob || '',
      gender: emp.gender || 'male',
      emergency_contact_name: emp.emergency_contact_name || '',
      emergency_contact_phone: emp.emergency_contact_phone || '',
      emergency_contact_relation: emp.emergency_contact_relation || '',
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmp) {
        await onUpdateEmployee(editingEmp.id, formData);
      } else {
        await onCreateEmployee(formData);
      }
      setShowAddModal(false);
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleUploadDoc = async (empId: string) => {
    if (!newDocName) {
      alert('Please enter document title/file name');
      return;
    }
    try {
      await onAddDocument(empId, {
        document_type: newDocType,
        file_name: newDocName,
        file_url: `/docs/${newDocName.toLowerCase().replace(/\s+/g, '-')}.pdf`,
        expiry_date: newDocExpiry || undefined,
      });
      setNewDocName('');
      setNewDocExpiry('');
      // Update viewing modal state
      const updated = employees.find(e => e.id === empId);
      if (updated) setViewingEmp(updated);
    } catch (err: any) {
      alert(err.message || 'Doc upload failed');
    }
  };

  const filteredEmployees = employees.filter(e => {
    const matchesSearch =
      e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.phone?.includes(searchTerm) ||
      e.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.designation?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !deptFilter || e.department === deptFilter;
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, phone, designation..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:outline-none focus:border-amber-500"
          >
            <option value="">All Departments</option>
            {departments.map((d: any) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:outline-none focus:border-amber-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="probation">Probation</option>
            <option value="notice_period">Notice Period</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Designation & Dept</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Base Salary</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">
                    No employees matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-stone-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs">
                          {emp.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-stone-900">{emp.name}</div>
                          <div className="text-[11px] text-stone-400">ID: {emp.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-stone-900">{emp.designation || 'Staff'}</div>
                      <div className="text-[11px] text-stone-500">{emp.department || 'General'}</div>
                    </td>
                    <td className="py-3 px-4 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-stone-800">
                        <Phone className="w-3 h-3 text-stone-400" />
                        <span>{emp.phone || 'N/A'}</span>
                      </div>
                      {emp.email && (
                        <div className="flex items-center gap-1.5 text-stone-500 text-[11px]">
                          <Mail className="w-3 h-3 text-stone-400" />
                          <span>{emp.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-900">
                      ৳{(emp.base_salary || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 capitalize">
                      <span className="inline-flex items-center gap-1 text-stone-700">
                        <CreditCard className="w-3 h-3 text-stone-400" />
                        {emp.payment_method || 'Bank'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          emp.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : emp.status === 'probation'
                            ? 'bg-blue-100 text-blue-800'
                            : emp.status === 'notice_period'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {(emp.status || 'Active').replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => setViewingEmp(emp)}
                        title="View Profile & Documents"
                        className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(emp)}
                        title="Edit Employee"
                        className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold text-base text-stone-900">
                {editingEmp ? `Edit Employee: ${editingEmp.name}` : 'New Employee Registration'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">National ID / NID</label>
                  <input
                    type="text"
                    value={formData.nid_number}
                    onChange={e => setFormData({ ...formData, nid_number: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500 bg-white"
                  >
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Designation</label>
                  <select
                    value={formData.designation}
                    onChange={e => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500 bg-white"
                  >
                    {designations.map((d: any) => (
                      <option key={d.id} value={d.title}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Branch / Location</label>
                  <select
                    value={formData.branch}
                    onChange={e => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500 bg-white"
                  >
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Shift</label>
                  <select
                    value={formData.shift}
                    onChange={e => setFormData({ ...formData, shift: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500 bg-white"
                  >
                    {shifts.map((s: any) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.start_time} - {s.end_time})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Base Monthly Salary (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.base_salary}
                    onChange={e => setFormData({ ...formData, base_salary: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Employment Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="probation">Probation</option>
                    <option value="notice_period">Notice Period</option>
                    <option value="resigned">Resigned</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Disbursement Method</label>
                  <select
                    value={formData.payment_method}
                    onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="bank">Bank Transfer</option>
                    <option value="bkash">bKash MFS</option>
                    <option value="cash">Cash Register</option>
                  </select>
                </div>

                {formData.payment_method === 'bank' ? (
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Bank Name & A/C No.</label>
                    <input
                      type="text"
                      placeholder="e.g. City Bank 1102938491"
                      value={formData.bank_account_no}
                      onChange={e => setFormData({ ...formData, bank_account_no: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ) : formData.payment_method === 'bkash' ? (
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">bKash Account Number</label>
                    <input
                      type="text"
                      placeholder="01XXXXXXXXX"
                      value={formData.bkash_number}
                      onChange={e => setFormData({ ...formData, bkash_number: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={formData.joining_date}
                    onChange={e => setFormData({ ...formData, joining_date: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={e => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Emergency Contact section */}
              <div className="border-t border-stone-200 pt-3">
                <h4 className="font-semibold text-stone-900 mb-2">Emergency Contact</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={formData.emergency_contact_name}
                    onChange={e => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    className="px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Relation (e.g. Brother, Spouse)"
                    value={formData.emergency_contact_relation}
                    onChange={e => setFormData({ ...formData, emergency_contact_relation: e.target.value })}
                    className="px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Emergency Phone"
                    value={formData.emergency_contact_phone}
                    onChange={e => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    className="px-3 py-2 rounded border border-stone-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-stone-300 rounded font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 text-white rounded font-bold hover:bg-stone-800 shadow"
                >
                  {editingEmp ? 'Save Changes' : 'Register Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Profile & Document Repository Modal */}
      {viewingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-sm">
                  {viewingEmp.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900">{viewingEmp.name}</h3>
                  <div className="text-xs text-stone-500">
                    {viewingEmp.designation} • {viewingEmp.department}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingEmp(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs">
              {/* Core Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Base Salary</span>
                  <span className="font-bold text-stone-900 text-sm">৳{(viewingEmp.base_salary || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Payment</span>
                  <span className="font-bold text-stone-900 capitalize">{viewingEmp.payment_method || 'Bank'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Branch</span>
                  <span className="font-bold text-stone-900">{viewingEmp.branch || 'Banani'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Status</span>
                  <span className="font-bold text-emerald-700 uppercase">{viewingEmp.status}</span>
                </div>
              </div>

              {/* Personal & Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-stone-200 rounded-lg p-3 space-y-2">
                  <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-1">Contact & ID</h4>
                  <p><span className="text-stone-500">Phone:</span> {viewingEmp.phone}</p>
                  <p><span className="text-stone-500">Email:</span> {viewingEmp.email || 'N/A'}</p>
                  <p><span className="text-stone-500">NID No:</span> {viewingEmp.nid_number || 'N/A'}</p>
                  <p><span className="text-stone-500">Date of Birth:</span> {viewingEmp.dob || 'N/A'}</p>
                </div>

                <div className="border border-stone-200 rounded-lg p-3 space-y-2">
                  <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-1">Emergency Contact</h4>
                  <p><span className="text-stone-500">Name:</span> {viewingEmp.emergency_contact_name || 'N/A'}</p>
                  <p><span className="text-stone-500">Relationship:</span> {viewingEmp.emergency_contact_relation || 'N/A'}</p>
                  <p><span className="text-stone-500">Phone:</span> {viewingEmp.emergency_contact_phone || 'N/A'}</p>
                </div>
              </div>

              {/* Document Repository */}
              <div className="border border-stone-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-600" />
                    <h4 className="font-bold text-stone-900">Document Repository & Compliance</h4>
                  </div>
                  <span className="text-stone-400 text-[11px]">
                    {viewingEmp.documents?.length || 0} Files Attached
                  </span>
                </div>

                {/* Upload Doc Form */}
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 flex flex-wrap gap-2 items-center">
                  <select
                    value={newDocType}
                    onChange={e => setNewDocType(e.target.value)}
                    className="px-2 py-1.5 rounded border border-stone-300 bg-white"
                  >
                    <option value="NID">National ID (NID)</option>
                    <option value="Contract">Employment Contract</option>
                    <option value="Resume">Resume / CV</option>
                    <option value="Trade_License">Trade / Professional License</option>
                    <option value="Certificate">Educational Certificate</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Document Title (e.g. NID-Front-Back)"
                    value={newDocName}
                    onChange={e => setNewDocName(e.target.value)}
                    className="px-3 py-1.5 rounded border border-stone-300 flex-1 min-w-[150px]"
                  />
                  <input
                    type="date"
                    title="Expiry Date (optional)"
                    value={newDocExpiry}
                    onChange={e => setNewDocExpiry(e.target.value)}
                    className="px-2 py-1.5 rounded border border-stone-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleUploadDoc(viewingEmp.id)}
                    className="px-3 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800 flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" /> Attach
                  </button>
                </div>

                {/* Documents List */}
                <div className="divide-y divide-stone-100">
                  {(!viewingEmp.documents || viewingEmp.documents.length === 0) ? (
                    <div className="py-4 text-center text-stone-400">No documents attached yet.</div>
                  ) : (
                    viewingEmp.documents.map((doc: any) => (
                      <div key={doc.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-stone-900 flex items-center gap-2">
                            <span>{doc.file_name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 text-[10px]">
                              {doc.document_type}
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-400">
                            Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                            {doc.expiry_date && ` • Expires: ${doc.expiry_date}`}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm('Remove this document?')) {
                              await onRemoveDocument(viewingEmp.id, doc.id);
                              setViewingEmp({
                                ...viewingEmp,
                                documents: viewingEmp.documents.filter((d: any) => d.id !== doc.id),
                              });
                            }
                          }}
                          className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
