import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Users,
  Target,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Sparkles,
  RefreshCw,
  ArrowRight,
  LifeBuoy,
  ThumbsUp,
  Award,
  Zap,
} from 'lucide-react';
import { crmApi } from './crmApi';
import { CRMDashboardSummary } from '../../types';

interface CRMDashboardTabProps {
  onNavigateTab: (tabId: string) => void;
}

export const CRMDashboardTab: React.FC<CRMDashboardTabProps> = ({ onNavigateTab }) => {
  const [summary, setSummary] = useState<CRMDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAuto, setRunningAuto] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await crmApi.getDashboard();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load CRM dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleRunAutomations = async () => {
    try {
      setRunningAuto(true);
      await crmApi.runAutomations();
      await fetchDashboard();
    } catch (err) {
      console.error('Automation error:', err);
    } finally {
      setRunningAuto(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-[var(--text-secondary)]">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading CRM intelligence and metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pipeline Value */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Pipeline Value
            </span>
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-num text-[var(--text)]">
              ৳{(summary?.pipeline_value || 0).toLocaleString()}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-[var(--text)]">{summary?.total_leads || 0}</span> active leads tracked
            </div>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Lead Conversion
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-num text-emerald-600">
              {summary?.conversion_rate || 0}%
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
              <span>{summary?.leads_by_stage?.won || 0} won deals closed</span>
            </div>
          </div>
        </div>

        {/* Tasks Due Today */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Tasks Due Today
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-num text-amber-600">
              {summary?.tasks_due_today || 0}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
              {summary?.tasks_overdue ? (
                <span className="text-rose-600 font-bold">{summary.tasks_overdue} overdue follow-ups</span>
              ) : (
                <span className="text-emerald-600 font-semibold">Zero overdue tasks</span>
              )}
            </div>
          </div>
        </div>

        {/* Customer Satisfaction */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Avg CSAT Rating
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <ThumbsUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-num text-[var(--text)]">
              {(summary?.csat_avg || 0).toFixed(1)} / 5.0
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
              <span>{summary?.open_tickets || 0} open support tickets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar & Quick Links */}
      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--text)]">
              Mirage Intelligent Relationship Engine
            </h4>
            <p className="text-xs text-[var(--text-secondary)]">
              Automated dormancy alerts, fragrance replenishment cycles, and Messenger lead nurturing.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleRunAutomations}
            disabled={runningAuto}
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text)] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-500 ${runningAuto ? 'animate-spin' : ''}`} />
            {runningAuto ? 'Running Rules...' : 'Run Automations Now'}
          </button>
          <button
            onClick={() => onNavigateTab('leads')}
            className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1.5 transition-colors"
          >
            <span>+ Add New Lead</span>
          </button>
        </div>
      </div>

      {/* Two Column Layout: Pipeline Breakdown & Reorder Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Stage Breakdown */}
        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--accent)]" />
                Pipeline by Sales Stage
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Active opportunities progressing through the sales funnel
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('leads')}
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              View Pipeline <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {[
              { key: 'new', label: 'New Inquiries', color: 'bg-blue-500', text: 'text-blue-600' },
              { key: 'contacted', label: 'Engaged & Contacted', color: 'bg-indigo-500', text: 'text-indigo-600' },
              { key: 'qualified', label: 'Qualified Buyer', color: 'bg-purple-500', text: 'text-purple-600' },
              { key: 'proposal', label: 'Offer & Price Sent', color: 'bg-amber-500', text: 'text-amber-600' },
              { key: 'won', label: 'Won & Converted', color: 'bg-emerald-500', text: 'text-emerald-600' },
              { key: 'lost', label: 'Lost / Discarded', color: 'bg-rose-500', text: 'text-rose-600' },
            ].map((stage) => {
              const count = summary?.leads_by_stage?.[stage.key] || 0;
              const total = summary?.total_leads || 1;
              const pct = Math.round((count / (total || 1)) * 100);

              return (
                <div key={stage.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text)]">{stage.label}</span>
                    <span className="font-num font-bold text-[var(--text-secondary)]">
                      {count} leads ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[var(--surface-hover)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stage.color} transition-all duration-300`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fragrance Reorder Opportunities */}
        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  Replenishment & Reorder Prompts
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Customers approaching estimated bottle empty date based on 100ml spray usage
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('customers')}
                className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                Customer 360 <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {summary?.reorder_candidates && summary.reorder_candidates.length > 0 ? (
              <div className="space-y-3">
                {summary.reorder_candidates.slice(0, 4).map((cand) => (
                  <div
                    key={`${cand.customer_id}-${cand.product_id}`}
                    className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text)]">
                          {cand.customer_name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold">
                          {cand.days_since_last_order} days ago
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Purchased <span className="font-semibold text-[var(--text)]">{cand.product_name}</span>
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        Suggested: {cand.suggested_product}
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigateTab('tasks')}
                      className="px-2.5 py-1.5 text-xs font-bold rounded border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--accent)] shrink-0 transition-colors"
                    >
                      Follow-up
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed border-[var(--border)] rounded-lg text-xs text-[var(--text-secondary)]">
                No immediate reorder prompts. Customer spray cycles are up to date.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Cycle calculation: ~60-90 days for 100ML perfume EDP</span>
            <span className="font-bold text-[var(--accent)]">{summary?.reorder_candidates?.length || 0} total candidates</span>
          </div>
        </div>
      </div>

      {/* Upcoming Special Dates & Celebrations */}
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              Upcoming Customer Celebrations (Next 30 Days)
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Birthdays, anniversaries, and gift occasions for targeted VIP outreach
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('feedback')}
            className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
          >
            Manage Dates <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {summary?.upcoming_dates && summary.upcoming_dates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.upcoming_dates.map((d: any, idx: number) => {
              const occasion = typeof d.occasion === 'string'
                ? d.occasion
                : (d.date_obj?.type || d.date_obj?.label || 'Celebration');
              const dateStr = typeof d.date === 'string'
                ? d.date
                : (d.date_obj?.date || '');
              const daysAway = d.days_away ?? d.days_left ?? 0;
              const notes = d.notes || d.date_obj?.notes || '';
              const id = d.id || d.date_obj?.id || `date_${idx}`;

              return (
                <div
                  key={id}
                  className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-[var(--text)]">{d.customer_name || 'Customer'}</div>
                    <div className="text-[11px] text-[var(--text-secondary)] capitalize">
                      {occasion.replace(/_/g, ' ')} {dateStr ? `• ${dateStr}` : ''}
                    </div>
                    {notes && <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">{notes}</div>}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-purple-500/10 text-purple-600">
                    in {daysAway} days
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center border border-dashed border-[var(--border)] rounded-lg text-xs text-[var(--text-secondary)]">
            No celebrations recorded in the next 30 days. Add birthdays or anniversaries in Customer 360!
          </div>
        )}
      </div>
    </div>
  );
};
