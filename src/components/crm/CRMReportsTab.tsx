import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Users,
  Calendar,
  Gift,
  Award,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { crmApi } from './crmApi';
import { CRMAnalyticsReport, SpecialDate } from '../../types';

export const CRMReportsTab: React.FC = () => {
  const [report, setReport] = useState<CRMAnalyticsReport | null>(null);
  const [upcomingDates, setUpcomingDates] = useState<SpecialDate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [rep, dates] = await Promise.all([crmApi.getReports(), crmApi.getSpecialDates(30)]);
        setReport(rep);
        setUpcomingDates(Array.isArray(dates) ? dates : []);
      } catch (err) {
        console.error('Failed to load CRM reports:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading || !report) {
    return (
      <div className="p-12 text-center text-xs text-[var(--text-secondary)]">
        Loading CRM reports and analytics...
      </div>
    );
  }

  const oppSummary = report.opportunity_summary || {
    total_deals: 0,
    total_pipeline: 0,
    won_deals: 0,
    won_value: 0,
    lost_deals: 0,
  };
  const lifecycleDist = report.lifecycle_distribution || {};
  const leadSources = report.lead_sources || {};

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Lead Conversion Rate
          </span>
          <div className="text-2xl font-bold font-num text-emerald-600 mt-1">
            {report.lead_conversion_rate ? `${report.lead_conversion_rate.toFixed(1)}%` : '0%'}
          </div>
          <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 block">
            Leads successfully converted to orders
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Total Opportunities
          </span>
          <div className="text-2xl font-bold font-num text-[var(--text)] mt-1">
            {oppSummary.total_deals} Deals
          </div>
          <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 block">
            ৳{oppSummary.total_pipeline.toLocaleString()} total value
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Won Deals
          </span>
          <div className="text-2xl font-bold font-num text-emerald-600 mt-1">
            {oppSummary.won_deals} Won
          </div>
          <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 block">
            ৳{oppSummary.won_value.toLocaleString()} closed
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Upcoming Customer Dates
          </span>
          <div className="text-2xl font-bold font-num text-purple-600 mt-1">
            {(upcomingDates || []).length}
          </div>
          <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 block">
            Next 30 days (Birthdays, Eid, Milestones)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Lifecycle Distribution */}
        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-4">
          <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[var(--accent)]" />
            Customer Lifecycle Distribution (RFM)
          </h3>

          <div className="space-y-3">
            {Object.entries(lifecycleDist).map(([status, count]) => {
              const total = Object.values(lifecycleDist).reduce((a: number, b: number) => a + Number(b), 0);
              const numCount = Number(count);
              const pct = total > 0 ? ((numCount / total) * 100).toFixed(1) : '0';
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text)] capitalize">
                      {status.replace('_', ' ')}
                    </span>
                    <span className="font-num text-[var(--text-secondary)]">
                      {numCount} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--surface-hover)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead Sources Breakdown */}
        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-4">
          <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            Lead Acquisition Sources
          </h3>

          <div className="space-y-3">
            {Object.entries(leadSources).map(([source, count]) => {
              const total = Object.values(leadSources).reduce((a: number, b: number) => a + Number(b), 0);
              const numCount = Number(count);
              const pct = total > 0 ? ((numCount / total) * 100).toFixed(1) : '0';
              return (
                <div key={source} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text)] capitalize">
                      {source.replace('_', ' ')}
                    </span>
                    <span className="font-num text-[var(--text-secondary)]">
                      {numCount} leads ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--surface-hover)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Special Dates Next 30 Days */}
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-4">
        <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
          <Gift className="w-4 h-4 text-purple-600" />
          Upcoming Customer Milestones & Celebrations (Next 30 Days)
        </h3>

        {upcomingDates.length === 0 ? (
          <div className="text-xs text-[var(--text-secondary)] text-center py-4">
            No customer birthdays or anniversaries in the next 30 days.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingDates.map((date) => (
              <div
                key={date.id}
                className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] flex items-start justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-[var(--text)]">{date.customer_name}</span>
                  <div className="text-[11px] text-[var(--accent)] font-semibold capitalize mt-0.5">
                    {(date.occasion || date.label || date.type || '').replace('_', ' ')} • {date.date}
                  </div>
                  {date.notes && (
                    <div className="text-[10px] text-[var(--text-secondary)] mt-1">{date.notes}</div>
                  )}
                </div>
                <Gift className="w-4 h-4 text-purple-500 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
