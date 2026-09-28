import React, { useState } from 'react';
import {
  Building2,
  Briefcase,
  MapPin,
  Clock,
  Calendar,
  Plus,
  X,
  Trash2,
} from 'lucide-react';

interface OrganizationTabProps {
  departments: any[];
  designations: any[];
  branches: any[];
  shifts: any[];
  holidays: any[];
  onCreateDepartment: (data: any) => Promise<void>;
  onCreateDesignation: (data: any) => Promise<void>;
  onCreateBranch: (data: any) => Promise<void>;
  onCreateShift: (data: any) => Promise<void>;
  onCreateHoliday: (data: any) => Promise<void>;
}

export const OrganizationTab: React.FC<OrganizationTabProps> = ({
  departments,
  designations,
  branches,
  shifts,
  holidays,
  onCreateDepartment,
  onCreateDesignation,
  onCreateBranch,
  onCreateShift,
  onCreateHoliday,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'departments' | 'designations' | 'branches' | 'shifts' | 'holidays'>('departments');

  // Modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });

  const [showDesigModal, setShowDesigModal] = useState(false);
  const [desigForm, setDesigForm] = useState({ name: '', department_id: departments[0]?.id || '', level: 1 });

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: '', code: '', address: '', is_warehouse: false });

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    name: 'Showroom General Shift',
    start_time: '10:00',
    end_time: '19:00',
    grace_period_minutes: 15,
    half_day_hours: 4.5,
  });

  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: new Date().toISOString().slice(0, 10),
    is_optional: false,
    description: '',
  });

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateDepartment(deptForm);
      setShowDeptModal(false);
      setDeptForm({ name: '', code: '', description: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to create department');
    }
  };

  const handleSaveDesig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateDesignation(desigForm);
      setShowDesigModal(false);
      setDesigForm({ name: '', department_id: departments[0]?.id || '', level: 1 });
    } catch (err: any) {
      alert(err.message || 'Failed to create designation');
    }
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateBranch(branchForm);
      setShowBranchModal(false);
      setBranchForm({ name: '', code: '', address: '', is_warehouse: false });
    } catch (err: any) {
      alert(err.message || 'Failed to create branch');
    }
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateShift(shiftForm);
      setShowShiftModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create shift');
    }
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateHoliday(holidayForm);
      setShowHolidayModal(false);
      setHolidayForm({ name: '', date: new Date().toISOString().slice(0, 10), is_optional: false, description: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to add holiday');
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'departments', label: 'Departments', icon: Building2 },
            { id: 'designations', label: 'Designations', icon: Briefcase },
            { id: 'branches', label: 'Branches & Stores', icon: MapPin },
            { id: 'shifts', label: 'Work Shifts', icon: Clock },
            { id: 'holidays', label: 'Holidays Calendar', icon: Calendar },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div>
          {activeSubTab === 'departments' && (
            <button
              onClick={() => setShowDeptModal(true)}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Department
            </button>
          )}
          {activeSubTab === 'designations' && (
            <button
              onClick={() => setShowDesigModal(true)}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Designation
            </button>
          )}
          {activeSubTab === 'branches' && (
            <button
              onClick={() => setShowBranchModal(true)}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Branch
            </button>
          )}
          {activeSubTab === 'shifts' && (
            <button
              onClick={() => setShowShiftModal(true)}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Configure Shift
            </button>
          )}
          {activeSubTab === 'holidays' && (
            <button
              onClick={() => setShowHolidayModal(true)}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Holiday
            </button>
          )}
        </div>
      </div>

      {/* Subtab Content */}
      {activeSubTab === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map(dept => (
            <div key={dept.id} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-900 text-sm">{dept.name}</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700 uppercase">
                  {dept.code}
                </span>
              </div>
              <p className="text-xs text-stone-500">{dept.description || 'Core organizational unit'}</p>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === 'designations' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Designation Title</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Hierarchy Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {designations.map(desig => (
                <tr key={desig.id} className="hover:bg-stone-50/70">
                  <td className="py-3 px-4 font-bold text-stone-900">{desig.name}</td>
                  <td className="py-3 px-4 text-stone-600">{desig.department_name || 'General'}</td>
                  <td className="py-3 px-4 font-semibold text-stone-800">Level {desig.level || 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {branches.map(branch => (
            <div key={branch.id} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-900 text-sm">{branch.name}</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                  {branch.code}
                </span>
              </div>
              <div className="text-xs text-stone-600 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-stone-400" />
                <span>{branch.address}</span>
              </div>
              <div className="pt-2 border-t border-stone-100 text-[11px] font-semibold text-stone-500">
                {branch.is_warehouse ? 'Distribution Hub / Warehouse' : 'Retail Flagship Outlet'}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === 'shifts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map(shift => (
            <div key={shift.id} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-900 text-sm">{shift.name}</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                  ACTIVE
                </span>
              </div>
              <div className="text-lg font-bold text-stone-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>
                  {shift.start_time} - {shift.end_time}
                </span>
              </div>
              <div className="space-y-1 text-xs text-stone-600 border-t border-stone-100 pt-2">
                <div className="flex justify-between">
                  <span>Late Grace Period:</span>
                  <span className="font-semibold text-stone-900">{shift.grace_period_minutes} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span>Half-Day Minimum:</span>
                  <span className="font-semibold text-stone-900">{shift.half_day_hours} hours</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === 'holidays' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Holiday Name</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {holidays.map(h => (
                <tr key={h.id} className="hover:bg-stone-50/70">
                  <td className="py-3 px-4 font-bold text-stone-900">{h.name}</td>
                  <td className="py-3 px-4 font-semibold text-stone-800">{h.date}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700">
                      {h.is_optional ? 'OPTIONAL' : 'MANDATORY'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-stone-500">{h.description || 'Public Holiday'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Dept Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Add Department</h3>
              <button onClick={() => setShowDeptModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDept} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quality Assurance / Decanting"
                  value={deptForm.name}
                  onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Department Code</label>
                <input
                  type="text"
                  placeholder="e.g. QA"
                  value={deptForm.code}
                  onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Designation Modal */}
      {showDesigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Add Designation</h3>
              <button onClick={() => setShowDesigModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDesig} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Inventory Specialist"
                  value={desigForm.name}
                  onChange={e => setDesigForm({ ...desigForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Department</label>
                <select
                  value={desigForm.department_id}
                  onChange={e => setDesigForm({ ...desigForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowDesigModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Save Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Add Location / Branch</h3>
              <button onClick={() => setShowBranchModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveBranch} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Uttara Experience Center"
                  value={branchForm.name}
                  onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Address *</label>
                <input
                  type="text"
                  required
                  placeholder="Sector 3, Uttara, Dhaka"
                  value={branchForm.address}
                  onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_warehouse"
                  checked={branchForm.is_warehouse}
                  onChange={e => setBranchForm({ ...branchForm, is_warehouse: e.target.checked })}
                />
                <label htmlFor="is_warehouse" className="text-stone-700 font-semibold">
                  Is Warehouse / Distribution Hub
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Configure Shift Schedule</h3>
              <button onClick={() => setShowShiftModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveShift} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Shift Name *</label>
                <input
                  type="text"
                  required
                  value={shiftForm.name}
                  onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.start_time}
                    onChange={e => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.end_time}
                    onChange={e => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Grace Period (Minutes)</label>
                  <input
                    type="number"
                    min={0}
                    value={shiftForm.grace_period_minutes}
                    onChange={e => setShiftForm({ ...shiftForm, grace_period_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Half Day Hours</label>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    value={shiftForm.half_day_hours}
                    onChange={e => setShiftForm({ ...shiftForm, half_day_hours: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded border border-stone-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Holiday Modal */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Add Holiday</h3>
              <button onClick={() => setShowHolidayModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveHoliday} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Holiday Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eid-ul-Fitr Holiday"
                  value={holidayForm.name}
                  onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={holidayForm.date}
                  onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowHolidayModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
