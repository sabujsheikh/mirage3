import React, { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Calendar,
  User,
  Filter,
  Search,
  Check,
  ChevronRight,
  AlarmClock,
  Sparkles,
} from 'lucide-react';
import { crmApi } from './crmApi';
import { CRMTask, CRMTaskPriority, CRMTaskStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

export const FollowUpsTab: React.FC = () => {
  const { currentUser } = useAuth();
  const { customers } = useApp();
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [completeModalTask, setCompleteModalTask] = useState<CRMTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');

  const [formData, setFormData] = useState<Partial<CRMTask>>({
    title: '',
    description: '',
    due_date: new Date().toISOString().split('T')[0],
    priority: 'medium',
    task_type: 'follow_up',
    customer_name: '',
    customer_phone: '',
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await crmApi.getTasks({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, priorityFilter]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.due_date) return;

    try {
      await crmApi.createTask(
        {
          ...formData,
          assigned_to: currentUser?.id || 'usr_owner',
          assigned_to_name: currentUser?.name || 'Sobuj Sehk',
        },
        currentUser?.id
      );
      setShowAddModal(false);
      setFormData({
        title: '',
        description: '',
        due_date: new Date().toISOString().split('T')[0],
        priority: 'medium',
        task_type: 'follow_up',
        customer_name: '',
        customer_phone: '',
      });
      await fetchTasks();
    } catch (err) {
      console.error('Task creation failed:', err);
    }
  };

  const handleCompleteTask = async () => {
    if (!completeModalTask) return;
    try {
      await crmApi.completeTask(completeModalTask.id, completionNotes, currentUser?.id);
      setCompleteModalTask(null);
      setCompletionNotes('');
      await fetchTasks();
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const handleSnooze = async (taskId: string, days: number) => {
    try {
      const d = new Date();
      d.setDate(d.getDate() + days);
      await crmApi.snoozeTask(taskId, d.toISOString().split('T')[0], currentUser?.id);
      await fetchTasks();
    } catch (err) {
      console.error('Failed to snooze task:', err);
    }
  };

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = safeTasks.filter((t) => t && t.status !== 'completed' && t.due_date < today);
  const todayTasks = safeTasks.filter((t) => t && t.status !== 'completed' && t.due_date === today);
  const upcomingTasks = safeTasks.filter((t) => t && t.status !== 'completed' && t.due_date > today);
  const completedTasks = safeTasks.filter((t) => t && t.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5">
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Overdue</div>
          <div className="text-xl font-bold font-num text-rose-700 mt-1">{overdueTasks.length}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Due Today</div>
          <div className="text-xl font-bold font-num text-amber-700 mt-1">{todayTasks.length}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Upcoming</div>
          <div className="text-xl font-bold font-num text-blue-700 mt-1">{upcomingTasks.length}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Completed</div>
          <div className="text-xl font-bold font-num text-emerald-700 mt-1">{completedTasks.length}</div>
        </div>
      </div>

      {/* Action and Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Follow-up Task</span>
        </button>
      </div>

      {/* Task Sections */}
      <div className="space-y-6">
        {/* Overdue Section */}
        {overdueTasks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Overdue Follow-ups ({overdueTasks.length})
            </h3>
            <div className="space-y-2">
              {overdueTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onComplete={() => setCompleteModalTask(t)}
                  onSnooze={(days) => handleSnooze(t.id, days)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Due Today Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Due Today ({todayTasks.length})
          </h3>
          {todayTasks.length === 0 ? (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-secondary)] text-center">
              All tasks for today are completed or scheduled for upcoming days.
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onComplete={() => setCompleteModalTask(t)}
                  onSnooze={(days) => handleSnooze(t.id, days)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Upcoming ({upcomingTasks.length})
          </h3>
          {upcomingTasks.length === 0 ? (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-secondary)] text-center">
              No upcoming scheduled tasks.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onComplete={() => setCompleteModalTask(t)}
                  onSnooze={(days) => handleSnooze(t.id, days)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Task */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--text)]">Schedule Customer Follow-up</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call back regarding Oud Royal EDP discount"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as CRMTaskPriority })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="Arif Islam"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Customer Phone
                  </label>
                  <input
                    type="text"
                    placeholder="01XXXXXXXXX"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Task Type
                </label>
                <select
                  value={formData.task_type}
                  onChange={(e) => setFormData({ ...formData, task_type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                >
                  <option value="follow_up">General Follow-Up</option>
                  <option value="call">Phone Call</option>
                  <option value="message">Messenger / WhatsApp Message</option>
                  <option value="reorder_reminder">Replenishment / Reorder Prompt</option>
                  <option value="payment_chase">Payment Verification</option>
                  <option value="complaint_resolution">Complaint Resolution</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Description / Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Context, agreed price, delivery instructions..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-bold hover:bg-[var(--accent)]/90"
                >
                  Schedule Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Complete Task */}
      {completeModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Complete Follow-up
              </h3>
              <button
                onClick={() => setCompleteModalTask(null)}
                className="text-[var(--text-secondary)] hover:text-[var(--text)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2">
              <div className="font-bold text-[var(--text)]">{completeModalTask.title}</div>
              <textarea
                rows={3}
                placeholder="Add completion notes (e.g. customer ordered 2 bottles, will confirm tomorrow)..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)] text-xs">
              <button
                type="button"
                onClick={() => setCompleteModalTask(null)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteTask}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
              >
                Mark Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component: Task Card
const TaskCard: React.FC<{
  task: CRMTask;
  onComplete: () => void;
  onSnooze: (days: number) => void;
}> = ({ task, onComplete, onSnooze }) => {
  const priorityBadges: Record<string, string> = {
    urgent: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    high: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    medium: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    low: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20',
  };

  return (
    <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${
              priorityBadges[task.priority] || priorityBadges.medium
            }`}
          >
            {task.priority}
          </span>
          <h4 className="text-xs font-bold text-[var(--text)]">{task.title}</h4>
        </div>

        {task.description && (
          <p className="text-[11px] text-[var(--text-secondary)]">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)] pt-0.5">
          {task.customer_name && (
            <span className="font-semibold text-[var(--text)] flex items-center gap-1">
              <User className="w-3 h-3" />
              {task.customer_name} {task.customer_phone ? `(${task.customer_phone})` : ''}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Due: {task.due_date}
          </span>
          <span>Assigned: {task.assigned_to_name}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]">
        <button
          onClick={() => onSnooze(1)}
          className="px-2 py-1 text-[11px] rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] flex items-center gap-1"
          title="Snooze 1 day"
        >
          <AlarmClock className="w-3 h-3" />
          +1d
        </button>
        <button
          onClick={() => onSnooze(3)}
          className="px-2 py-1 text-[11px] rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
          title="Snooze 3 days"
        >
          +3d
        </button>
        <button
          onClick={onComplete}
          className="px-3 py-1 text-[11px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          Done
        </button>
      </div>
    </div>
  );
};
