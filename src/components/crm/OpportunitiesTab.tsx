import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  DollarSign,
  Plus,
  Calendar,
  Percent,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Building,
} from 'lucide-react';
import { crmApi } from './crmApi';
import { Opportunity } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

export const OpportunitiesTab: React.FC = () => {
  const { currentUser } = useAuth();
  const { customers } = useApp();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState<Partial<Opportunity>>({
    title: '',
    customer_id: '',
    customer_name: '',
    value: 0,
    probability: 50,
    stage: 'prospecting',
    closing_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    notes: '',
  });

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const data = await crmApi.getOpportunities();
      setOpportunities(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const handleSaveOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.value) return;

    try {
      await crmApi.createOpportunity(formData, currentUser?.id, currentUser?.name);
      setShowModal(false);
      setFormData({
        title: '',
        customer_id: '',
        customer_name: '',
        value: 0,
        probability: 50,
        stage: 'prospecting',
        closing_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        notes: '',
      });
      await fetchOpportunities();
    } catch (err) {
      console.error('Failed to create opportunity:', err);
    }
  };

  const handleStageUpdate = async (id: string, stage: any) => {
    try {
      await crmApi.updateOpportunity(id, { stage }, currentUser?.id);
      await fetchOpportunities();
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  };

  const safeOpportunities = Array.isArray(opportunities) ? opportunities : [];
  const totalPipeline = safeOpportunities
    .filter((o) => o && o.stage !== 'closed_lost')
    .reduce((sum, o) => sum + (o.value || 0), 0);

  const weightedPipeline = safeOpportunities
    .filter((o) => o && o.stage !== 'closed_lost')
    .reduce((sum, o) => sum + ((o.value || 0) * (o.probability || 0)) / 100, 0);

  const stageBadges: Record<string, { label: string; class: string }> = {
    prospecting: { label: 'Prospecting', class: 'bg-blue-500/10 text-blue-600' },
    proposal: { label: 'Proposal Sent', class: 'bg-indigo-500/10 text-indigo-600' },
    negotiation: { label: 'Negotiation', class: 'bg-amber-500/10 text-amber-600' },
    closed_won: { label: 'Closed Won', class: 'bg-emerald-500/10 text-emerald-600' },
    closed_lost: { label: 'Closed Lost', class: 'bg-rose-500/10 text-rose-600' },
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Total Deal Value
          </span>
          <div className="text-2xl font-bold font-num text-[var(--text)] mt-1">
            ৳{totalPipeline.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            Across {opportunities.length} tracked deals
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Weighted Forecast
          </span>
          <div className="text-2xl font-bold font-num text-emerald-600 mt-1">
            ৳{Math.round(weightedPipeline).toLocaleString()}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            Factored by closing probability
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Won Deals
            </span>
            <div className="text-2xl font-bold font-num text-[var(--text)] mt-1">
              {opportunities.filter((o) => o.stage === 'closed_won').length}
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Deal
          </button>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[var(--accent)]" />
            Active Deals & Wholesale Contracts
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)] text-[var(--text-secondary)] uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Deal Title</th>
                <th className="py-3 px-4">Customer / Organization</th>
                <th className="py-3 px-4 text-right">Value (৳)</th>
                <th className="py-3 px-4 text-center">Probability</th>
                <th className="py-3 px-4">Expected Close</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {opportunities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-secondary)]">
                    No deals or bulk opportunities recorded.
                  </td>
                </tr>
              ) : (
                opportunities.map((opp) => (
                  <tr key={opp.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[var(--text)]">{opp.title}</div>
                      {opp.notes && <div className="text-[11px] text-[var(--text-secondary)]">{opp.notes}</div>}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)] font-medium">
                      {opp.customer_name || 'Individual VIP'}
                    </td>
                    <td className="py-3 px-4 text-right font-num font-bold text-[var(--text)]">
                      ৳{(opp.value || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-num font-bold text-[var(--text)]">{opp.probability}%</span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{opp.closing_date}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stageBadges[opp.stage]?.class}`}>
                        {stageBadges[opp.stage]?.label || opp.stage}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {opp.stage !== 'closed_won' && (
                          <button
                            onClick={() => handleStageUpdate(opp.id, 'closed_won')}
                            className="p-1 rounded hover:bg-emerald-50 text-emerald-600"
                            title="Mark Closed Won"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {opp.stage !== 'closed_lost' && (
                          <button
                            onClick={() => handleStageUpdate(opp.id, 'closed_lost')}
                            className="p-1 rounded hover:bg-rose-50 text-rose-600"
                            title="Mark Closed Lost"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Opportunity */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)]">New Wholesale / Corporate Deal</h3>
            <form onSubmit={handleSaveOpportunity} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Deal Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50pcs Eid Corporate Perfume Gift Box"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Customer / Organization
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => {
                    const c = customers.find((cust) => cust.id === e.target.value);
                    setFormData({
                      ...formData,
                      customer_id: e.target.value,
                      customer_name: c?.name || '',
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                >
                  <option value="">Select Existing Customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {!formData.customer_id && (
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Or Organization Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Holdings Ltd"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Deal Value (৳) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="50000"
                    value={formData.value || ''}
                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] font-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Probability (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) => setFormData({ ...formData, probability: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] font-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Stage
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  >
                    <option value="prospecting">Prospecting</option>
                    <option value="proposal">Proposal Sent</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="closed_won">Closed Won</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Expected Close Date
                  </label>
                  <input
                    type="date"
                    value={formData.closing_date}
                    onChange={(e) => setFormData({ ...formData, closing_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Terms, requested packaging customization..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-bold"
                >
                  Save Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
