import React, { useState } from 'react';
import {
  TrendingUp,
  Target,
  Award,
  Plus,
  Star,
  CheckCircle2,
  Calendar,
  X,
} from 'lucide-react';

interface PerformanceTabProps {
  goals: any[];
  reviews: any[];
  employees: any[];
  onCreateGoal: (data: any) => Promise<void>;
  onUpdateGoal: (id: string, data: any) => Promise<void>;
  onCreateReview: (data: any) => Promise<void>;
}

export const PerformanceTab: React.FC<PerformanceTabProps> = ({
  goals,
  reviews,
  employees,
  onCreateGoal,
  onUpdateGoal,
  onCreateReview,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'goals' | 'reviews'>('goals');
  const [empFilter, setEmpFilter] = useState('');

  // Modals
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({
    employee_id: employees[0]?.id || '',
    title: '',
    target_metric: '',
    progress: 0,
    status: 'in_progress',
    weight: 20,
    due_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  });

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    employee_id: employees[0]?.id || '',
    reviewer_id: 'usr_owner',
    reviewer_name: 'Sobuj Sehk',
    review_period: '2026-Q1',
    rating: 4.5,
    accomplishments: '',
    areas_for_improvement: '',
  });

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateGoal(goalForm);
      setShowGoalModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create goal');
    }
  };

  const handleUpdateProgress = async (goalId: string, currentGoal: any, progressVal: number) => {
    try {
      const newStatus = progressVal >= 100 ? 'completed' : progressVal > 0 ? 'in_progress' : 'not_started';
      await onUpdateGoal(goalId, { ...currentGoal, progress: progressVal, status: newStatus });
    } catch (err: any) {
      alert(err.message || 'Failed to update goal progress');
    }
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateReview(reviewForm);
      setShowReviewModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to record performance review');
    }
  };

  const filteredGoals = goals.filter(g => !empFilter || g.employee_id === empFilter);
  const filteredReviews = reviews.filter(r => !empFilter || r.employee_id === empFilter);

  return (
    <div className="space-y-6">
      {/* Subtab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('goals')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'goals'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>KPIs & Strategic Goals</span>
          </button>
          <button
            onClick={() => setActiveSubTab('reviews')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'reviews'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Performance Reviews</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={empFilter}
            onChange={e => setEmpFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded border border-stone-300 bg-white"
          >
            <option value="">All Staff</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>

          {activeSubTab === 'goals' ? (
            <button
              onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Assign KPI / Goal
            </button>
          ) : (
            <button
              onClick={() => setShowReviewModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Conduct Review
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'goals' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGoals.length === 0 ? (
            <div className="col-span-full py-12 text-center text-stone-400 bg-white rounded-xl border border-stone-200">
              No performance goals assigned for this filter. Click "Assign KPI / Goal" to establish targets.
            </div>
          ) : (
            filteredGoals.map(goal => (
              <div key={goal.id} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900 text-sm">{goal.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      goal.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {(goal.status || 'In Progress').replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div className="text-xs text-stone-600">
                  <span className="font-semibold text-stone-900">{goal.employee_name}</span> • Due: {goal.due_date}
                </div>

                <div className="text-xs text-stone-500 bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                  Target: {goal.target_metric || 'Standard KPI Target'}
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Progress:</span>
                    <span className="font-bold text-stone-900">{goal.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, goal.progress || 0)}%` }}
                    />
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-stone-400">Update progress:</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={goal.progress || 0}
                      onChange={e => handleUpdateProgress(goal.id, goal, Number(e.target.value))}
                      className="w-28 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Reviews Subtab */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReviews.length === 0 ? (
            <div className="col-span-full py-12 text-center text-stone-400 bg-white rounded-xl border border-stone-200">
              No performance appraisals recorded yet.
            </div>
          ) : (
            filteredReviews.map(rev => (
              <div key={rev.id} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">{rev.employee_name}</h4>
                    <span className="text-[11px] text-stone-400">Review Cycle: {rev.review_period}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-bold text-xs text-amber-900">{rev.rating || 4.5} / 5.0</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-emerald-800 block">Key Accomplishments:</span>
                    <p className="text-stone-600 bg-stone-50 p-2 rounded border border-stone-100 mt-1">
                      {rev.accomplishments || 'Consistently met sales quotas and maintained high showroom standards.'}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-amber-800 block">Development Areas:</span>
                    <p className="text-stone-600 bg-stone-50 p-2 rounded border border-stone-100 mt-1">
                      {rev.areas_for_improvement || 'Encourage perfume notes deep-dive training for niche clientele.'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Assign Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Assign KPI / Strategic Goal</h3>
              <button onClick={() => setShowGoalModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateGoal} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Employee *</label>
                <select
                  value={goalForm.employee_id}
                  onChange={e => setGoalForm({ ...goalForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Goal / KPI Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Achieve ৳500,000 monthly showroom sales"
                  value={goalForm.title}
                  onChange={e => setGoalForm({ ...goalForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Target Metric</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly sales volume or 99% inventory accuracy"
                  value={goalForm.target_metric}
                  onChange={e => setGoalForm({ ...goalForm, target_metric: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Due Date</label>
                <input
                  type="date"
                  value={goalForm.due_date}
                  onChange={e => setGoalForm({ ...goalForm, due_date: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Assign Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Conduct Performance Appraisal</h3>
              <button onClick={() => setShowReviewModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateReview} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Employee *</label>
                <select
                  value={reviewForm.employee_id}
                  onChange={e => setReviewForm({ ...reviewForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Review Period</label>
                <input
                  type="text"
                  placeholder="e.g. 2026-Q1 or Annual 2025"
                  value={reviewForm.review_period}
                  onChange={e => setReviewForm({ ...reviewForm, review_period: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Rating (1 to 5 Stars)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  value={reviewForm.rating}
                  onChange={e => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Key Accomplishments</label>
                <textarea
                  rows={2}
                  value={reviewForm.accomplishments}
                  onChange={e => setReviewForm({ ...reviewForm, accomplishments: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Areas for Growth</label>
                <textarea
                  rows={2}
                  value={reviewForm.areas_for_improvement}
                  onChange={e => setReviewForm({ ...reviewForm, areas_for_improvement: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Save Appraisal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
