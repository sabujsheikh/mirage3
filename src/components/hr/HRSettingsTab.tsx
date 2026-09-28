import React, { useState } from 'react';
import { Sliders, Save, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

interface HRSettingsTabProps {
  settings: any;
  onUpdateSettings: (data: any) => Promise<void>;
}

export const HRSettingsTab: React.FC<HRSettingsTabProps> = ({ settings, onUpdateSettings }) => {
  const [formData, setFormData] = useState({
    working_days_per_week: settings.working_days_per_week || 6,
    work_hours_per_day: settings.work_hours_per_day || 9,
    standard_shift_start: settings.standard_shift_start || '10:00',
    standard_shift_end: settings.standard_shift_end || '19:00',
    grace_period_minutes: settings.grace_period_minutes || 15,
    half_day_late_threshold_hours: settings.half_day_late_threshold_hours || 4,
    probation_period_months: settings.probation_period_months || 3,
    notice_period_days: settings.notice_period_days || 30,
    overtime_multiplier: settings.overtime_multiplier || 1.5,
    auto_deduct_absences: settings.auto_deduct_absences ?? true,
    require_two_level_approval_for_leaves: settings.require_two_level_approval_for_leaves ?? false,
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await onUpdateSettings(formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save HR settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-600" />
            <span>Configurable HR & Operational Policies</span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Owner-configurable parameters governing attendance grace limits, leave workflows, and payroll calculations.
          </p>
        </div>
        {success && (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Policies Updated
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Attendance & Shift Policy */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-2 text-sm">
            Work Schedule & Attendance Tolerance
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Working Days Per Week</label>
              <input
                type="number"
                min={4}
                max={7}
                value={formData.working_days_per_week}
                onChange={e => setFormData({ ...formData, working_days_per_week: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded border border-stone-300"
              />
              <span className="text-[11px] text-stone-400">Default for Bangladesh retail showrooms is 6 days.</span>
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Standard Daily Work Hours</label>
              <input
                type="number"
                min={4}
                max={14}
                value={formData.work_hours_per_day}
                onChange={e => setFormData({ ...formData, work_hours_per_day: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded border border-stone-300"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Arrival Grace Period (Minutes)</label>
              <input
                type="number"
                min={0}
                max={60}
                value={formData.grace_period_minutes}
                onChange={e => setFormData({ ...formData, grace_period_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded border border-stone-300"
              />
              <span className="text-[11px] text-stone-400">Punches within grace are marked as "Present".</span>
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Half-Day Lateness Threshold (Hours)</label>
              <input
                type="number"
                min={1}
                max={8}
                value={formData.half_day_late_threshold_hours}
                onChange={e => setFormData({ ...formData, half_day_late_threshold_hours: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded border border-stone-300"
              />
              <span className="text-[11px] text-stone-400">Lateness beyond this threshold marks a Half-Day.</span>
            </div>
          </div>
        </div>

        {/* Tenure & Employment Policy */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-2 text-sm">
            Probation, Notice & Overtime Multipliers
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Standard Probation (Months)</label>
              <input
                type="number"
                min={1}
                max={12}
                value={formData.probation_period_months}
                onChange={e => setFormData({ ...formData, probation_period_months: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded border border-stone-300"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Notice Period (Days)</label>
              <input
                type="number"
                min={0}
                max={180}
                value={formData.notice_period_days}
                onChange={e => setFormData({ ...formData, notice_period_days: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded border border-stone-300"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Overtime Hourly Multiplier</label>
              <input
                type="number"
                min={1}
                max={3}
                step={0.1}
                value={formData.overtime_multiplier}
                onChange={e => setFormData({ ...formData, overtime_multiplier: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded border border-stone-300"
              />
            </div>
          </div>
        </div>

        {/* Automation & Approvals */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-2 text-sm">
            Payroll Automation & Workflow Controls
          </h4>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto_deduct"
                checked={formData.auto_deduct_absences}
                onChange={e => setFormData({ ...formData, auto_deduct_absences: e.target.checked })}
                className="w-4 h-4 rounded text-stone-900"
              />
              <label htmlFor="auto_deduct" className="text-stone-800 font-semibold cursor-pointer">
                Automatically calculate and deduct unapproved absences during payroll run
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="two_level_approval"
                checked={formData.require_two_level_approval_for_leaves}
                onChange={e => setFormData({ ...formData, require_two_level_approval_for_leaves: e.target.checked })}
                className="w-4 h-4 rounded text-stone-900"
              />
              <label htmlFor="two_level_approval" className="text-stone-800 font-semibold cursor-pointer">
                Enforce 2-level approvals for leaves (Reporting Manager approval then HR Owner sign-off)
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save HR Policies'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
