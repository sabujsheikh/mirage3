import React, { useEffect, useState } from 'react';
import {
  Zap,
  Play,
  CheckCircle2,
  Clock,
  Settings,
  Bell,
  UserCheck,
  RotateCw,
  Sliders,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { crmApi } from './crmApi';
import { CRMAutomationRule } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const AutomationsTab: React.FC = () => {
  const { currentUser } = useAuth();
  const [rules, setRules] = useState<CRMAutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{ message?: string; timestamp?: string } | null>(null);

  const fetchAutomations = async () => {
    try {
      setLoading(true);
      const data = await crmApi.getAutomations();
      setRules(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load automation rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  const handleToggleRule = async (rule: CRMAutomationRule) => {
    try {
      await crmApi.updateAutomation(rule.id, { active: !rule.active }, currentUser?.id);
      await fetchAutomations();
    } catch (err) {
      console.error('Failed to update automation rule:', err);
    }
  };

  const handleRunAutomations = async () => {
    try {
      setRunning(true);
      const res = await crmApi.runAutomations();
      setLastResult({
        message: res.message || 'Automations executed successfully. Follow-up tasks and notifications synced.',
        timestamp: new Date().toLocaleTimeString(),
      });
      await fetchAutomations();
    } catch (err) {
      console.error('Failed to run automations:', err);
      setLastResult({
        message: 'Error executing rules. Please check server logs.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setRunning(false);
    }
  };

  const safeRules = Array.isArray(rules) ? rules : [];
  const activeCount = safeRules.filter((r) => r && r.active).length;

  const triggerLabels: Record<string, { label: string; desc: string; icon: React.ReactNode }> = {
    new_lead: {
      label: 'New Lead Inbound',
      desc: 'Triggers immediately when a new Messenger, WhatsApp, or walk-in lead is recorded.',
      icon: <Bell className="w-4 h-4 text-blue-500" />,
    },
    lead_inactivity: {
      label: 'Lead Inactivity Warning',
      desc: 'Triggers when a lead has not received contact or updates beyond the threshold.',
      icon: <Clock className="w-4 h-4 text-amber-500" />,
    },
    order_delivered: {
      label: 'Order Delivery Check-in',
      desc: 'Triggers after a parcel is marked delivered by Steadfast or in-house delivery.',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    },
    customer_dormant: {
      label: 'Customer Dormancy Guard',
      desc: 'Triggers when a previously active perfume customer has placed no orders in 60+ days.',
      icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
    },
    ticket_unresolved: {
      label: 'Unresolved Ticket Escalation',
      desc: 'Triggers when a customer support ticket or return inquiry remains open past SLA.',
      icon: <ShieldCheck className="w-4 h-4 text-purple-500" />,
    },
    special_date_approaching: {
      label: 'Milestone & Birthday Reminder',
      desc: 'Triggers 7 days before customer birthdays or purchase anniversaries.',
      icon: <Zap className="w-4 h-4 text-pink-500" />,
    },
  };

  const actionLabels: Record<string, string> = {
    assign_user: 'Auto-assign responsible sales staff',
    create_task: 'Generate follow-up task with reminder',
    update_lifecycle: 'Update customer lifecycle status & alert manager',
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Run Trigger */}
      <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
              <Zap className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-[var(--text)]">
              Automated CRM Rules & Background Tasks
            </h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] max-w-xl">
            Proactively triggers follow-up reminders, reorder check-ins, customer lifecycle updates, and fragrance feedback prompts without manual micromanagement.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRunAutomations}
            disabled={running}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-2 transition-all shadow-xs disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Processing Rules...' : 'Execute Automations Now'}
          </button>
        </div>
      </div>

      {lastResult && (
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {lastResult.message}
          </span>
          <span className="text-[10px] text-[var(--text-secondary)]">
            Run at {lastResult.timestamp}
          </span>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Active Automation Rules
          </span>
          <div className="text-2xl font-bold font-num text-[var(--text)] mt-1">
            {activeCount} / {rules.length}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            System rules evaluating customer events
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Engine Health
          </span>
          <div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Operational
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            Internal event-driven scheduling active
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Auto-Task Creation
          </span>
          <div className="text-2xl font-bold font-num text-[var(--text)] mt-1">
            Enabled
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            Routes to Assigned Sales & Showroom staff
          </div>
        </div>
      </div>

      {/* Automation Rules List */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[var(--accent)]" />
            Configured Workflow Rules
          </h4>
          <button
            onClick={fetchAutomations}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] flex items-center gap-1"
          >
            <RotateCw className="w-3 h-3" />
            Refresh Rules
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--text-secondary)]">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--text-secondary)]">No rules found.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {rules.map((rule) => {
              const trigger = triggerLabels[rule.trigger_type] || {
                label: rule.trigger_type,
                desc: 'Custom trigger event',
                icon: <Zap className="w-4 h-4 text-amber-500" />,
              };

              return (
                <div
                  key={rule.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <div className="flex items-start gap-3.5 max-w-2xl">
                    <div className="p-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] shrink-0 mt-0.5">
                      {trigger.icon}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-[var(--text)]">{rule.name}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)]">
                          {trigger.label}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">{trigger.desc}</p>
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-3 pt-1">
                        <span>Action: <strong className="text-[var(--text)] font-medium">{actionLabels[rule.action_type] || rule.action_type}</strong></span>
                        {rule.config?.hours_threshold && (
                          <span>Threshold: <strong className="text-[var(--text)] font-medium">{rule.config.hours_threshold} hours</strong></span>
                        )}
                        {rule.config?.days_threshold && (
                          <span>Threshold: <strong className="text-[var(--text)] font-medium">{rule.config.days_threshold} days</strong></span>
                        )}
                        {rule.config?.task_title && (
                          <span>Task: <strong className="text-[var(--text)] font-medium">"{rule.config.task_title}"</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        rule.active
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                      }`}
                    >
                      {rule.active ? 'Active' : 'Disabled'}
                    </span>
                    <button
                      onClick={() => handleToggleRule(rule)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rule.active ? 'bg-[var(--accent)]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          rule.active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
