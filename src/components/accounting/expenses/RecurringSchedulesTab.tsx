import React from 'react';
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  TrendingDown,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { ExpenseTemplate } from '../../../types';

export interface RecurringScheduleItem {
  template: ExpenseTemplate;
  due_date: string;
  is_due: boolean;
  is_overdue: boolean;
  status: 'paid' | 'due_today' | 'overdue' | 'upcoming';
  last_expense_id?: string;
  last_expense_date?: string;
}

interface RecurringSchedulesTabProps {
  schedules: RecurringScheduleItem[];
  onPaySchedule: (template: ExpenseTemplate) => void;
  canManage: boolean;
}

export const RecurringSchedulesTab: React.FC<RecurringSchedulesTabProps> = ({
  schedules,
  onPaySchedule,
  canManage,
}) => {
  const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  const totalMonthlyCommitment = schedules.reduce(
    (sum, s) => sum + (s.template.default_amount || 0),
    0
  );
  const paidCount = schedules.filter((s) => s.status === 'paid').length;
  const overdueCount = schedules.filter((s) => s.status === 'overdue').length;
  const dueTodayCount = schedules.filter((s) => s.status === 'due_today').length;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span className="text-xs font-semibold">Monthly Obligations</span>
            <Calendar className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-mono font-black text-[var(--text)]">
            &#2547;{totalMonthlyCommitment.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">For {currentMonth}</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span className="text-xs font-semibold">Paid This Month</span>
            <CheckCircle2 className="w-4 h-4 text-[var(--status-teal)]" />
          </div>
          <div className="text-2xl font-mono font-black text-[var(--status-teal)]">
            {paidCount} of {schedules.length}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Settled operational bills</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span className="text-xs font-semibold">Overdue Bills</span>
            <AlertCircle className={`w-4 h-4 ${overdueCount > 0 ? 'text-[var(--status-red)]' : 'text-[var(--text-muted)]'}`} />
          </div>
          <div className={`text-2xl font-mono font-black ${overdueCount > 0 ? 'text-[var(--status-red)]' : 'text-[var(--text)]'}`}>
            {overdueCount}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Past scheduled due date</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span className="text-xs font-semibold">Due Today / Soon</span>
            <Clock className="w-4 h-4 text-[var(--status-amber)]" />
          </div>
          <div className="text-2xl font-mono font-black text-[var(--status-amber)]">
            {dueTodayCount}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Immediate action required</div>
        </div>
      </div>

      {/* Schedules List */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-sunken)] flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
              Recurring Monthly Schedule Tracker ({currentMonth})
            </h4>
            <p className="text-[11px] text-[var(--text-muted)]">
              Scheduled operating disbursements with automated matching to logged expense vouchers
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="dense-table w-full text-xs">
            <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4 text-left">Bill / Template Name</th>
                <th className="py-3 px-4 text-left">Category & Subcategory</th>
                <th className="py-3 px-4 text-left">Scheduled Due Date</th>
                <th className="py-3 px-4 text-right">Default Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                    No recurring bills configured. Create a template and mark it as a "Recurring Monthly Bill".
                  </td>
                </tr>
              ) : (
                schedules.map((item) => {
                  const t = item.template;
                  return (
                    <tr key={t.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--text)]">{t.name}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">
                          Disburse: {t.default_payment_account_name || 'Cash Till'} ({t.default_payment_method})
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-[var(--accent)]">{t.category_name}</span>
                        {t.subcategory && (
                          <div className="text-[10px] text-[var(--text-muted)]">{t.subcategory}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-[var(--text)]">Day {t.recurring_day} of month</div>
                        <div className="text-[10px] text-[var(--text-muted)]">Due: {item.due_date}</div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[var(--status-red)]">
                        &#2547;{(t.default_amount || 0).toLocaleString()}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {item.status === 'paid' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-[color-mix(in_srgb,var(--status-teal)_12%,transparent)] text-[var(--status-teal)] border border-[color-mix(in_srgb,var(--status-teal)_30%,transparent)]">
                            <CheckCircle2 className="w-3 h-3" />
                            Paid for {currentMonth.slice(0, 3)}
                          </span>
                        )}
                        {item.status === 'due_today' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-[color-mix(in_srgb,var(--status-amber)_12%,transparent)] text-[var(--status-amber)] border border-[color-mix(in_srgb,var(--status-amber)_30%,transparent)] animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            Due Today
                          </span>
                        )}
                        {item.status === 'overdue' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-[color-mix(in_srgb,var(--status-red)_12%,transparent)] text-[var(--status-red)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)]">
                            <AlertCircle className="w-3 h-3" />
                            Overdue
                          </span>
                        )}
                        {item.status === 'upcoming' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text-muted)]">
                            <Clock className="w-3 h-3" />
                            Upcoming
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {item.status === 'paid' ? (
                          <span className="text-[11px] text-[var(--status-teal)] font-medium">
                            Settled {item.last_expense_date ? `(${item.last_expense_date})` : ''}
                          </span>
                        ) : (
                          <button
                            onClick={() => onPaySchedule(t)}
                            className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-bold hover:opacity-90 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Record Voucher</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
